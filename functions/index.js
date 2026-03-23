const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MASTER_USER = String(process.env.MASTER_USER || "jssantana077").trim().toLowerCase();
const MASTER_PASS = String(process.env.MASTER_PASS || "852347");
const FORCED_REMOVED_USER = "__forced_removed_user_disabled__";
const INACTIVE_MSG = "Usuario Inactivo o eliminado. Comuníquese con su proveedor.";
const PAYPAL_RECEIVER = String(process.env.PAYPAL_RECEIVER || "Jssantana077@gmail.com").trim();
const PAYPAL_ME_USER = String(process.env.PAYPAL_ME_USER || "Jhonn0723").trim();
const PAYPAL_WEBHOOK_ID = String(process.env.PAYPAL_WEBHOOK_ID || "").trim();
const PAYPAL_PRODUCT_NAME = "LuRo Control SaaS";
const PAYPAL_RUNTIME_OPTS = {
  secrets: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_PLAN_BASICO", "PAYPAL_PLAN_PROFESIONAL", "PAYPAL_PLAN_EMPRESARIAL", "PAYPAL_PRODUCT_ID"]
};

function getCloudRuntimeConfig() {
  try {
    const raw = String(process.env.CLOUD_RUNTIME_CONFIG || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function getPaypalClientId() {
  const cfg = getCloudRuntimeConfig();
  const val = String(
    process.env.PAYPAL_CLIENT_ID ||
    cfg?.paypal?.client_id ||
    ""
  ).trim();
  return /^MISSING/i.test(val) ? "" : val;
}

function getPaypalClientSecret() {
  const cfg = getCloudRuntimeConfig();
  const val = String(
    process.env.PAYPAL_CLIENT_SECRET ||
    cfg?.paypal?.client_secret ||
    ""
  ).trim();
  return /^MISSING/i.test(val) ? "" : val;
}

function getPaypalPlanIdFromConfig(planKey) {
  const key = norm(planKey);
  const cfg = getCloudRuntimeConfig();
  const fromEnv = process.env[`PAYPAL_PLAN_${String(key || "").toUpperCase()}`];
  const fromCfg = cfg?.paypal?.[`plan_${key}`];
  const val = safeText(fromEnv || fromCfg || "", 120);
  return /^MISSING/i.test(val) ? "" : val;
}

const PLAN_CATALOG = {
  basico: {
    id: "basico",
    nombre: "Plan Básico",
    montoUSD: 20.0,
    usuariosMax: 3,
    modulosMax: 8,
    sucursalesMax: 1
  },
  profesional: {
    id: "profesional",
    nombre: "Plan Profesional",
    montoUSD: 99.99,
    usuariosMax: 30,
    modulosMax: 999,
    sucursalesMax: 2
  },
  empresarial: {
    id: "empresarial",
    nombre: "Plan Empresarial",
    montoUSD: 349.99,
    usuariosMax: 30,
    modulosMax: 999,
    sucursalesMax: 10
  }
};

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

function safeText(v, max = 160) {
  return String(v || "").trim().slice(0, max);
}

function trialEndsAtTs(days = 15) {
  return admin.firestore.Timestamp.fromMillis(Date.now() + (Number(days || 15) * 24 * 60 * 60 * 1000));
}

function isTrialActive(data = {}) {
  const estado = String(data.estado || "").toLowerCase();
  if (estado !== "trial") return false;
  const trialEndRaw = data?.suscripcion?.trialEndsAt;
  const ms = trialEndRaw && typeof trialEndRaw.toMillis === "function"
    ? trialEndRaw.toMillis()
    : Number(new Date(trialEndRaw || 0).getTime() || 0);
  return ms > Date.now();
}

function canAccessByStatus(data = {}) {
  const estado = String(data.estado || "").toLowerCase();
  return estado === "activo";
}

function looksLikeDelegatedMasterOwner(data = {}) {
  if (!data || typeof data !== "object") return false;
  const estado = norm(data.estado);
  if (estado === "activo") return false;
  if (data.activo === false) return false;

  const hasSaasIdentity = Boolean(
    norm(data.negocioId) ||
    norm(data.email) ||
    norm(data.cedula) ||
    norm(data.phone) ||
    norm(data.adminName)
  );
  if (hasSaasIdentity) return false;

  const subProveedor = norm(data?.suscripcion?.proveedor);
  const markedAsDelegated = data?.suscripcion?.delegada === true || norm(data.dependenciaPago) === "master";
  const providerLooksDelegated = subProveedor.includes("master");
  const explicitParent = norm(data.parentOwner) || norm(data.delegadoPor);
  return Boolean(markedAsDelegated || providerLooksDelegated || explicitParent || (!estado && norm(data.pass)));
}

async function ensureDelegatedOwnerActive(ownerId, ownerData = {}, parentHint = "") {
  if (!ownerId || !looksLikeDelegatedMasterOwner(ownerData)) return ownerData;
  const parentOwner = norm(parentHint || ownerData.parentOwner || ownerData.delegadoPor || MASTER_USER) || MASTER_USER;
  const suscripcion = {
    ...(ownerData.suscripcion || {}),
    estado: "activa",
    proveedor: "master_delegada",
    delegada: true,
    parentOwner,
    montoUSD: Number(ownerData?.suscripcion?.montoUSD || 0)
  };
  await db.collection("owners").doc(ownerId).set({
    estado: "activo",
    plan: safeText(ownerData.plan || "delegado", 30),
    dependenciaPago: "master",
    parentOwner,
    suscripcion,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return {
    ...ownerData,
    estado: "activo",
    plan: safeText(ownerData.plan || "delegado", 30),
    dependenciaPago: "master",
    parentOwner,
    suscripcion
  };
}

function trialRemainingDays(data = {}) {
  if (!isTrialActive(data)) return 0;
  const trialEndRaw = data?.suscripcion?.trialEndsAt;
  const ms = trialEndRaw && typeof trialEndRaw.toMillis === "function"
    ? trialEndRaw.toMillis()
    : Number(new Date(trialEndRaw || 0).getTime() || 0);
  return Math.max(0, Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000)));
}

function normalizeSubState(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "active" || v === "activo" || v === "activa") return "active";
  if (v === "cancelled" || v === "cancelado" || v === "cancelada") return "cancelled";
  if (v === "failed" || v === "fallido" || v === "fallida" || v === "suspended") return "failed";
  if (v === "trial") return "pending";
  if (v === "pending" || v === "pending_payment" || v === "approval_pending") return "pending";
  return "pending";
}

function businessIdFromName(name) {
  const base = safeText(name, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `biz_${base || "negocio"}_${Date.now().toString(36).slice(-6)}`;
}

function createTenantDbSeed(owner, negocioId, negocioNombre) {
  return {
    tenant: {
      negocioId,
      nombre: negocioNombre,
      owner: owner,
      createdAt: Date.now()
    },
    usuarios: [{ user: owner, pass: "", role: "admin", owner: owner, activo: true, colab: [] }],
    platos: [],
    almacen: [],
    entradas: [],
    ventas: [],
    decomisos: [],
    autorizaciones: [],
    produccion_stock: [],
    historial_prod: [],
    distribuidores: [],
    catalogoDistribuidores: [],
    clientesRNC: [],
    facturasResumen: [],
    codigosClienteRNC: {},
    contadorCodigoCliente: 1,
    contadorCodigoFacturaBusqueda: 1,
    registroInicial: null,
    registroInicialUsuarios: {},
    recuperacionClave: null,
    registroInicialBackups: [],
    clientesFidelizacion: [],
    configMembresia: { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 },
    qrClienteLinks: {},
    entrenamientos: [],
    modulosCustom: [],
    cierresTotales: [],
    comandasActivas: [],
    comandasHistorial: [],
    deliveryMeta: {},
    mesaCuentas: {},
    mesaEstadoVenta: {},
    mesaClienteVenta: {},
    mesasEstado: {}
  };
}

function mustAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debe iniciar sesiÃ³n.");
  return request.auth;
}

function claims(request) {
  return request.auth?.token || {};
}

async function getOwnerDoc(owner) {
  const id = norm(owner);
  if (!id) return null;
  if (id === FORCED_REMOVED_USER) return null;
  if (id === MASTER_USER) {
    const masterDoc = await db.collection("owners").doc(MASTER_USER).get();
    if (masterDoc.exists) {
      const masterData = masterDoc.data() || {};
      return {
        id: MASTER_USER,
        data: {
          ...masterData,
          username: MASTER_USER,
          pass: String(masterData.pass || MASTER_PASS),
          activo: masterData.activo !== false,
          estado: String(masterData.estado || "activo"),
          empresa: String(masterData.empresa || "MASTER")
        }
      };
    }
    return {
      id: MASTER_USER,
      data: {
        username: MASTER_USER,
        pass: MASTER_PASS,
        activo: true,
        estado: "activo",
        empresa: "MASTER"
      }
    };
  }
  const direct = await db.collection("owners").doc(id).get();
  if (direct.exists) return { id, data: direct.data() || {} };
  const q = await db.collection("owners").where("username", "==", id).limit(1).get();
  if (q.empty) return null;
  return { id: q.docs[0].id, data: q.docs[0].data() || {} };
}

function isPasswordMatch(stored, incoming) {
  return String(stored || "") === String(incoming || "");
}

function sanitizeCollaboratorPerms(permisos = [], owner = "") {
  const ownerKey = norm(owner);
  const list = Array.isArray(permisos) ? permisos : [];
  const uniq = Array.from(new Set(list.filter(Boolean)));
  if (!uniq.includes("home")) uniq.unshift("home");
  if (ownerKey !== MASTER_USER) {
    return uniq.filter((p) => String(p || "").trim().toLowerCase() !== "clientes-puntos");
  }
  return uniq;
}

async function assertOwnerActive(owner) {
  const o = await getOwnerDoc(owner);
  if (!o) throw new HttpsError("permission-denied", INACTIVE_MSG);
  const normalizedOwner = await ensureDelegatedOwnerActive(o.id, o.data || {});
  if (normalizedOwner.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
  if (!canAccessByStatus(normalizedOwner || {})) {
    throw new HttpsError("permission-denied", "Suscripción inactiva. Complete su pago para continuar.");
  }
  return { ...o, data: normalizedOwner };
}

function buildPaypalLink({ plan, negocioId, owner }) {
  const cfg = PLAN_CATALOG[plan] || PLAN_CATALOG.basico;
  const amount = Number(cfg.montoUSD).toFixed(2);
  const paypalMeUser = PAYPAL_ME_USER.replace(/^@+/, "");
  if (paypalMeUser) {
    const u = new URL("https://www.paypal.com/");
    u.pathname = `/paypalme/${paypalMeUser}/${amount}`;
    u.searchParams.set("country.x", "DO");
    u.searchParams.set("locale.x", "es_XC");
    u.searchParams.set("description", `LuRo ${cfg.id} ${negocioId} ${owner}`.slice(0, 120));
    return u.toString();
  }

  // Fallback legado por si se desactiva paypal.me en la cuenta.
  const legacy = new URL("https://www.paypal.com/cgi-bin/webscr");
  legacy.searchParams.set("cmd", "_xclick");
  legacy.searchParams.set("business", PAYPAL_RECEIVER);
  legacy.searchParams.set("item_name", `LuRo Control ${cfg.nombre}`);
  legacy.searchParams.set("amount", amount);
  legacy.searchParams.set("currency_code", "USD");
  legacy.searchParams.set("no_shipping", "1");
  legacy.searchParams.set("custom", `${negocioId}|${plan}|${owner}`);
  return legacy.toString();
}

function normalizeBillingDay(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  if (i < 1 || i > 28) return 0;
  return i;
}

function getPayPalApiBase() {
  return "https://api-m.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId = getPaypalClientId();
  const clientSecret = getPaypalClientSecret();
  if (!clientId || !clientSecret) return "";
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.access_token) {
    throw new HttpsError("internal", "No se pudo autenticar contra PayPal API.");
  }
  return String(json.access_token || "");
}

async function paypalRequest(path, method = "GET", body = null, extraHeaders = {}) {
  const token = await getPayPalAccessToken();
  if (!token) throw new HttpsError("failed-precondition", "PayPal no está configurado en backend.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders
  };
  const resp = await fetch(`${getPayPalApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = safeText(json?.message || json?.name || `PayPal API ${resp.status}`, 180);
    throw new HttpsError("failed-precondition", `PayPal API: ${msg}`);
  }
  return json;
}

function planNodeId(planId) {
  const p = norm(planId) || "basico";
  return `paypal_plan_${p}`;
}

async function createPayPalProductIfMissing(existingProductId = "") {
  const productId = safeText(existingProductId, 80);
  if (productId) return productId;
  const reqId = `luro-product-${Date.now()}`;
  const json = await paypalRequest("/v1/catalogs/products", "POST", {
    name: PAYPAL_PRODUCT_NAME,
    description: "Suscripción mensual LuRo Control SaaS",
    type: "SERVICE",
    category: "SOFTWARE"
  }, { "PayPal-Request-Id": reqId });
  return safeText(json?.id, 80);
}

async function createPayPalPlan({ productId, planKey, planCfg }) {
  const reqId = `luro-plan-${planKey}-${Date.now()}`;
  const amount = Number(planCfg?.montoUSD || 0).toFixed(2);
  const json = await paypalRequest("/v1/billing/plans", "POST", {
    product_id: productId,
    name: String(planCfg?.nombre || `Plan ${planKey}`),
    description: `Suscripción mensual ${String(planCfg?.nombre || planKey)}`,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: amount, currency_code: "USD" }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 1
    }
  }, { "PayPal-Request-Id": reqId });
  return safeText(json?.id, 80);
}

async function ensurePayPalCatalog() {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const rootRef = db.collection("billing").doc("paypal_catalog");
  const rootSnap = await rootRef.get();
  const root = rootSnap.data() || {};
  let productId = safeText(root?.productId, 80);
  productId = await createPayPalProductIfMissing(productId);
  if (!productId) throw new HttpsError("internal", "No se pudo crear producto PayPal.");

  const createdPlanIds = {};
  for (const key of Object.keys(PLAN_CATALOG)) {
    const cfg = PLAN_CATALOG[key];
    const planRef = rootRef.collection("plans").doc(planNodeId(key));
    const planSnap = await planRef.get();
    const existing = safeText(planSnap.data()?.planId, 80);
    let planId = existing;
    if (!planId) {
      planId = await createPayPalPlan({ productId, planKey: key, planCfg: cfg });
      if (!planId) throw new HttpsError("internal", `No se pudo crear plan PayPal ${key}.`);
      await planRef.set({
        key,
        planId,
        nombre: cfg.nombre,
        montoUSD: Number(cfg.montoUSD || 0),
        billingInterval: "MONTH",
        updatedAt: now,
        createdAt: now
      }, { merge: true });
    }
    createdPlanIds[key] = planId;
  }

  await rootRef.set({
    productName: PAYPAL_PRODUCT_NAME,
    productId,
    updatedAt: now
  }, { merge: true });
  return { productId, planIds: createdPlanIds };
}

async function loadPayPalPlanIds() {
  const rootRef = db.collection("billing").doc("paypal_catalog");
  const plansSnap = await rootRef.collection("plans").get();
  const planIds = {
    basico: getPaypalPlanIdFromConfig("basico"),
    profesional: getPaypalPlanIdFromConfig("profesional"),
    empresarial: getPaypalPlanIdFromConfig("empresarial")
  };
  plansSnap.forEach((d) => {
    const it = d.data() || {};
    const key = norm(it.key);
    const id = safeText(it.planId, 80);
    if (key && id) planIds[key] = id;
  });
  return planIds;
}

async function getPlanIdForKey(planKey, strict = true) {
  const key = norm(planKey) || "basico";
  let planIds = await loadPayPalPlanIds();
  if (!planIds[key]) {
    if (getPaypalClientSecret()) {
      const ensured = await ensurePayPalCatalog();
      planIds = ensured?.planIds || {};
    }
  }
  const planId = safeText(planIds[key], 80);
  if (!planId && strict) throw new HttpsError("failed-precondition", "Plan de PayPal no disponible.");
  return planId;
}

async function getPayPalSubscription(subscriptionId) {
  const id = safeText(subscriptionId, 120);
  if (!id) throw new HttpsError("invalid-argument", "subscriptionId requerido.");
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(id)}`, "GET");
}

function billingDayFromDate(dateIso) {
  const dt = new Date(dateIso || "");
  if (Number.isNaN(dt.getTime())) return null;
  const day = dt.getUTCDate();
  return day >= 1 && day <= 31 ? day : null;
}

async function verifyPayPalWebhook(req, eventBody) {
  if (!PAYPAL_WEBHOOK_ID) return true;
  const transmissionId = safeText(req.header("paypal-transmission-id"), 180);
  const transmissionTime = safeText(req.header("paypal-transmission-time"), 120);
  const certUrl = safeText(req.header("paypal-cert-url"), 500);
  const authAlgo = safeText(req.header("paypal-auth-algo"), 80);
  const transmissionSig = safeText(req.header("paypal-transmission-sig"), 600);
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;

  const token = await getPayPalAccessToken();
  if (!token) return false;
  const resp = await fetch(`${getPayPalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: eventBody || {}
    })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) return false;
  return String(json?.verification_status || "").toUpperCase() === "SUCCESS";
}

function parseCustomId(customId) {
  const raw = String(customId || "");
  const [owner, negocioId, plan] = raw.split("|");
  return {
    owner: norm(owner),
    negocioId: safeText(negocioId, 120),
    plan: norm(plan) || "basico"
  };
}

async function resolvePlanKeyFromPaypalPlanId(paypalPlanId, fallbackPlan = "basico") {
  const id = safeText(paypalPlanId, 120);
  if (!id) return norm(fallbackPlan) || "basico";
  const plans = await loadPayPalPlanIds();
  for (const key of Object.keys(plans)) {
    if (safeText(plans[key], 120) === id) return key;
  }
  return norm(fallbackPlan) || "basico";
}

async function getPayPalOrder(orderId) {
  const id = safeText(orderId, 120);
  if (!id) throw new HttpsError("invalid-argument", "orderId de PayPal requerido.");
  const token = await getPayPalAccessToken();
  if (!token) return null;
  const resp = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new HttpsError("failed-precondition", "No se pudo validar la orden PayPal.");
  }
  return json || null;
}

async function activateBusinessSubscription({
  owner,
  negocioId,
  plan,
  provider,
  montoUSD,
  paymentRef,
  payerEmail,
  subscriptionId = "",
  paypalPlanId = "",
  nextBillingTime = "",
  billingDay = null
}) {
  const ownerId = norm(owner);
  const bizId = safeText(negocioId, 120);
  const planCfg = PLAN_CATALOG[norm(plan)] || PLAN_CATALOG.basico;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const amount = Number(montoUSD || planCfg.montoUSD || 0);
  const ownerEntry = await getOwnerDoc(ownerId);
  if (!ownerEntry) throw new HttpsError("not-found", "Cuenta de usuario no encontrada.");
  const ownerData = ownerEntry.data || {};
  const resolvedBizId = bizId || safeText(ownerData.negocioId, 120);
  if (!resolvedBizId) throw new HttpsError("failed-precondition", "Negocio no identificado para activar la suscripción.");

  const subPayload = {
    estado: "active",
    proveedor: String(provider || "paypal"),
    montoUSD: amount,
    paidAt: now
  };
  if (paymentRef) subPayload.paypalOrderId = safeText(paymentRef, 120);
  if (payerEmail) subPayload.payerEmail = safeText(payerEmail, 160);
  if (subscriptionId) subPayload.subscriptionId = safeText(subscriptionId, 120);
  if (paypalPlanId) subPayload.paypalPlanId = safeText(paypalPlanId, 120);
  if (nextBillingTime) subPayload.nextBillingTime = safeText(nextBillingTime, 60);
  if (billingDay) subPayload.billingDay = Number(billingDay);

  await db.collection("owners").doc(ownerEntry.id).set({
    username: ownerId,
    negocioId: resolvedBizId,
    plan: planCfg.id,
    estado: "activo",
    activo: true,
    suscripcion: subPayload,
    updatedAt: now
  }, { merge: true });

  await db.collection("negocios").doc(resolvedBizId).set({
    negocioId: resolvedBizId,
    owner: ownerId,
    plan: planCfg.id,
    estado: "activo",
    suscripcion: subPayload,
    updatedAt: now
  }, { merge: true });

  await emitMasterNotification({
    type: "subscription_payment_confirmed",
    owner: ownerId,
    negocioId: resolvedBizId,
    plan: planCfg.id,
    paymentStatus: "PAYMENT.SALE.COMPLETED",
    paymentRef: safeText(paymentRef || subscriptionId, 120),
    amountUSD: amount,
    payerEmail: safeText(payerEmail, 160)
  });

  if (subscriptionId) {
    await db.collection("paypal_subscriptions").doc(safeText(subscriptionId, 120)).set({
      owner: ownerId,
      negocioId: resolvedBizId,
      plan: planCfg.id,
      estado: "active",
      paypalPlanId: safeText(paypalPlanId, 120),
      payerEmail: safeText(payerEmail, 160),
      lastPaymentAt: now,
      nextBillingTime: safeText(nextBillingTime, 60),
      updatedAt: now
    }, { merge: true });
  }

  return {
    ok: true,
    owner: ownerId,
    negocioId: resolvedBizId,
    plan: planCfg.id,
    suscripcion: { ...subPayload, paidAt: Date.now() }
  };
}

async function setBusinessSubscriptionState({
  owner = "",
  negocioId = "",
  plan = "",
  status = "pending",
  provider = "paypal_subscription",
  amountUSD = 0,
  subscriptionId = "",
  paypalPlanId = "",
  payerEmail = "",
  paymentRef = "",
  nextBillingTime = "",
  billingDay = null,
  eventType = "",
  writeNotification = false
}) {
  const ownerId = norm(owner);
  if (!ownerId) throw new HttpsError("invalid-argument", "Owner requerido.");
  const ownerEntry = await getOwnerDoc(ownerId);
  if (!ownerEntry) throw new HttpsError("not-found", "Cuenta de usuario no encontrada.");
  const ownerData = ownerEntry.data || {};
  const bizId = safeText(negocioId || ownerData.negocioId, 120);
  if (!bizId) throw new HttpsError("failed-precondition", "Negocio no identificado.");

  const pKey = norm(plan || ownerData.plan || "basico");
  const planCfg = PLAN_CATALOG[pKey] || PLAN_CATALOG.basico;
  const finalStatus = normalizeSubState(status);
  const appEstado = finalStatus === "active" ? "activo" : "inactivo";
  const now = admin.firestore.FieldValue.serverTimestamp();
  const subPayload = {
    estado: finalStatus,
    proveedor: safeText(provider, 80),
    montoUSD: Number(amountUSD || planCfg.montoUSD || 0),
    subscriptionId: safeText(subscriptionId, 120),
    paypalPlanId: safeText(paypalPlanId, 120),
    payerEmail: safeText(payerEmail, 160),
    paymentRef: safeText(paymentRef, 120),
    nextBillingTime: safeText(nextBillingTime, 60),
    billingDay: Number(billingDay || 0) || null,
    updatedAt: now
  };
  if (finalStatus === "active") subPayload.lastPaymentAt = now;

  await db.collection("owners").doc(ownerEntry.id).set({
    username: ownerId,
    negocioId: bizId,
    plan: planCfg.id,
    estado: appEstado,
    activo: true,
    suscripcion: subPayload,
    updatedAt: now
  }, { merge: true });

  await db.collection("negocios").doc(bizId).set({
    negocioId: bizId,
    owner: ownerId,
    plan: planCfg.id,
    estado: appEstado,
    suscripcion: subPayload,
    updatedAt: now
  }, { merge: true });

  if (subscriptionId) {
    await db.collection("paypal_subscriptions").doc(safeText(subscriptionId, 120)).set({
      owner: ownerId,
      negocioId: bizId,
      plan: planCfg.id,
      estado: finalStatus,
      provider: safeText(provider, 80),
      amountUSD: Number(amountUSD || planCfg.montoUSD || 0),
      paypalPlanId: safeText(paypalPlanId, 120),
      payerEmail: safeText(payerEmail, 160),
      paymentRef: safeText(paymentRef, 120),
      nextBillingTime: safeText(nextBillingTime, 60),
      billingDay: Number(billingDay || 0) || null,
      updatedAt: now
    }, { merge: true });
  }

  if (writeNotification === true && eventType) {
    await emitMasterNotification({
      type: eventType === "PAYMENT.SALE.COMPLETED" ? "subscription_payment_confirmed" : "subscription_event",
      owner: ownerId,
      negocioId: bizId,
      plan: planCfg.id,
      paymentStatus: eventType,
      paymentRef: safeText(paymentRef || subscriptionId, 120),
      amountUSD: Number(amountUSD || planCfg.montoUSD || 0),
      payerEmail: safeText(payerEmail, 160)
    });
  }
}

function canManageOwner(request, owner) {
  const c = claims(request);
  const ownerClaim = norm(c.owner);
  return c.superMaster === true || ownerClaim === norm(owner);
}

function tsToIso(tsValue) {
  if (!tsValue) return "";
  if (typeof tsValue.toDate === "function") return tsValue.toDate().toISOString();
  const dt = new Date(tsValue);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function tsToMillis(tsValue) {
  if (!tsValue) return 0;
  if (typeof tsValue.toMillis === "function") return tsValue.toMillis();
  if (typeof tsValue.toDate === "function") return tsValue.toDate().getTime();
  const dt = new Date(tsValue);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
}

const SESSION_PRESENCE_STALE_MS = 70000;

function isPresenceOnline(data = {}) {
  if (data?.presenceOnline !== true) return false;
  const atMs = tsToMillis(data?.presenceUpdatedAt) || Number(data?.presenceUpdatedAtClient || 0);
  if (!atMs) return false;
  return (Date.now() - atMs) <= SESSION_PRESENCE_STALE_MS;
}

async function writeSessionPresence(session, online = true) {
  if (!session?.username) return false;
  const payload = {
    presenceOnline: online === true,
    presenceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    presenceUpdatedAtClient: Date.now()
  };

  if (session.collaborator === true) {
    const owner = norm(session.owner);
    const username = norm(session.username);
    if (!owner || !username) return false;
    await db.collection("autorizaciones").doc(`${owner}__${username}`).set(payload, { merge: true });
    return true;
  }

  const username = norm(session.username);
  if (!username) return false;
  const ownerEntry = await getOwnerDoc(username);
  const ownerDocId = ownerEntry?.id || username;
  const ownerData = ownerEntry?.data || {};
  await db.collection("owners").doc(ownerDocId).set({
    username,
    activo: ownerData.activo !== false,
    estado: String(ownerData.estado || "activo"),
    empresa: String(ownerData.empresa || (username === MASTER_USER ? "MASTER" : "")),
    plan: String(ownerData.plan || (username === MASTER_USER ? "empresarial" : "basico")),
    suscripcion: ownerData.suscripcion || (username === MASTER_USER ? { estado: "activa", proveedor: "master", montoUSD: 0 } : null),
    ...payload
  }, { merge: true });
  return true;
}

async function deleteByQuery(queryRef) {
  const snap = await queryRef.get();
  if (snap.empty) return 0;
  const batch = db.batch();
  let count = 0;
  snap.forEach((d) => {
    batch.delete(d.ref);
    count++;
  });
  await batch.commit();
  return count;
}

async function scrubCollaboratorReferences(owner, username) {
  const ownerKey = norm(owner);
  const userKey = norm(username);
  if (!ownerKey || !userKey) return false;

  const ownerDataRef = db.collection("datos_del_propietario").doc(ownerKey);
  const ownerDataDoc = await ownerDataRef.get();
  if (!ownerDataDoc.exists) return false;

  const payload = ownerDataDoc.data() || {};
  const tenantDb = (payload.db && typeof payload.db === "object") ? payload.db : (payload["base de datos"] || {});
  if (!tenantDb || typeof tenantDb !== "object") return false;

  if (Array.isArray(tenantDb.usuarios)) {
    tenantDb.usuarios = tenantDb.usuarios.filter((u) => {
      const uname = norm(u?.user);
      if (uname !== userKey) return true;
      return String(u?.role || "").toLowerCase() !== "colaborador";
    });
  }
  if (tenantDb.registroInicialUsuarios && typeof tenantDb.registroInicialUsuarios === "object") {
    delete tenantDb.registroInicialUsuarios[userKey];
  }

  await ownerDataRef.set({
    owner: ownerKey,
    db: tenantDb,
    "base de datos": tenantDb,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtClient: Date.now(),
    syncKey: `purge-colab-${Date.now()}`,
    updatedFrom: "purge-collaborator-hard"
  }, { merge: true });
  return true;
}

async function emitMasterNotification({
  type = "generic",
  owner = "",
  negocioId = "",
  plan = "",
  paymentStatus = "",
  paymentRef = "",
  amountUSD = 0,
  payerEmail = ""
}) {
  const ownerKey = norm(owner);
  if (!ownerKey) return null;
  const ref = db.collection("notificaciones_master").doc();
  const payload = {
    type: safeText(type, 80),
    owner: ownerKey,
    negocioId: safeText(negocioId, 120),
    plan: safeText(plan, 40),
    paymentStatus: safeText(paymentStatus, 60),
    paymentRef: safeText(paymentRef, 120),
    amountUSD: Number(amountUSD || 0),
    payerEmail: safeText(payerEmail, 160),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(payload, { merge: true });
  return ref.id;
}

async function resolveSession(request, allowCredentialFallback = false) {
  if (request.auth) {
    const c = claims(request);
    const owner = norm(c.owner);
    return {
      owner,
      username: norm(c.username),
      role: String(c.role || "").toLowerCase(),
      superMaster: c.superMaster === true,
      collaborator: c.collaborator === true,
      via: "auth"
    };
  }
  if (!allowCredentialFallback) throw new HttpsError("unauthenticated", "Debe iniciar sesiÃ³n.");

  const username = norm(request.data?.authUsername);
  const password = String(request.data?.authPassword || "");
  const ownerHint = norm(request.data?.authOwner);
  if (!username || !password) throw new HttpsError("unauthenticated", "Sin credenciales de respaldo.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("permission-denied", INACTIVE_MSG);

  // Permitir super-master por contraseña vigente (owners.pass o fallback MASTER_PASS).
  if (username === MASTER_USER) {
    const masterEntry = await getOwnerDoc(MASTER_USER);
    const masterPass = String(masterEntry?.data?.pass || MASTER_PASS);
    if (password === masterPass) {
      return {
        owner: MASTER_USER,
        username: MASTER_USER,
        role: "super-master",
        superMaster: true,
        collaborator: false,
        via: "credentials"
      };
    }
  }

  const ownerEntry = await getOwnerDoc(username);
  if (
    ownerEntry &&
    isPasswordMatch(ownerEntry.data.pass, password) &&
    ownerEntry.data.activo !== false &&
    canAccessByStatus(ownerEntry.data || {})
  ) {
    const role = username === MASTER_USER ? "super-master" : "admin";
    return {
      owner: username,
      username,
      role,
      superMaster: role === "super-master",
      collaborator: false,
      via: "credentials"
    };
  }

  if (ownerHint) {
    const docId = `${ownerHint}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(docId).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || !isPasswordMatch(colData.pass, password)) {
      throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
    }
    if (colData.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
    await assertOwnerActive(ownerHint);
    return {
      owner: ownerHint,
      username,
      role: "colaborador",
      superMaster: false,
      collaborator: true,
      via: "credentials"
    };
  }

  const q = await db.collection("autorizaciones").where("username", "==", username).limit(5).get();
  let colab = null;
  q.forEach((d) => {
    if (colab) return;
    const data = d.data() || {};
    if (isPasswordMatch(data.pass, password)) colab = data;
  });
  if (!colab) throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
  if (colab.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
  const owner = norm(colab.owner);
  await assertOwnerActive(owner);
  return {
    owner,
    username,
    role: "colaborador",
    superMaster: false,
    collaborator: true,
    via: "credentials"
  };
}

exports.authenticateSession = onCall(async (request) => {
  const username = norm(request.data?.username);
  const password = String(request.data?.password || "");
  const ownerHint = norm(request.data?.owner);
  if (!username || !password) throw new HttpsError("invalid-argument", "Credenciales incompletas.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("permission-denied", INACTIVE_MSG);

  // Super-master por contraseña vigente (owners.pass o fallback MASTER_PASS).
  if (username === MASTER_USER) {
    const masterEntry = await getOwnerDoc(MASTER_USER);
    const masterPass = String(masterEntry?.data?.pass || MASTER_PASS);
    if (password === masterPass) {
      return {
        ok: true,
        role: "super-master",
        owner: MASTER_USER,
        username: MASTER_USER,
        plan: String(masterEntry?.data?.plan || "empresarial"),
        estado: String(masterEntry?.data?.estado || "activo"),
        suscripcion: masterEntry?.data?.suscripcion || { estado: "activa", proveedor: "master", montoUSD: 0 },
        trialRemainingDays: 0,
        permisos: [],
        asignacionesEntradas: ["manual", "automatica", "historial"]
      };
    }
  }

  const ownerEntry = await getOwnerDoc(username);
  const ownerData = ownerEntry
    ? await ensureDelegatedOwnerActive(ownerEntry.id, ownerEntry.data || {}, MASTER_USER)
    : null;
  if (
    ownerEntry &&
    isPasswordMatch(ownerData?.pass, password) &&
    ownerData?.activo !== false &&
    canAccessByStatus(ownerData || {})
  ) {
    const role = username === MASTER_USER ? "super-master" : "admin";
    return {
      ok: true,
      role,
      owner: username,
      username,
      plan: String(ownerData?.plan || "basico"),
      estado: String(ownerData?.estado || "activo"),
      suscripcion: ownerData?.suscripcion || null,
      trialRemainingDays: trialRemainingDays(ownerData || {}),
      permisos: [],
      asignacionesEntradas: ["manual", "automatica", "historial"]
    };
  }

  if (ownerHint) {
    const docId = `${ownerHint}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(docId).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || !isPasswordMatch(colData.pass, password)) {
      throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
    }
    if (colData.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
    await assertOwnerActive(ownerHint);
    return {
      ok: true,
      role: "colaborador",
      owner: ownerHint,
      username,
      permisos: sanitizeCollaboratorPerms(Array.isArray(colData.permisos) ? colData.permisos : ["home", "salida"], ownerHint),
      asignacionesEntradas: Array.isArray(colData.asignacionesEntradas) ? colData.asignacionesEntradas : []
    };
  }

  const q = await db.collection("autorizaciones").where("username", "==", username).limit(5).get();
  let found = null;
  q.forEach((d) => {
    if (found) return;
    const data = d.data() || {};
    if (isPasswordMatch(data.pass, password)) found = { id: d.id, data };
  });
  if (!found) throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
  if (found.data.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);

  const owner = norm(found.data.owner);
  await assertOwnerActive(owner);
  return {
    ok: true,
    role: "colaborador",
    owner,
    username,
    negocioId: String(found.data.negocioId || ""),
    permisos: sanitizeCollaboratorPerms(Array.isArray(found.data.permisos) ? found.data.permisos : ["home", "salida"], owner),
    asignacionesEntradas: Array.isArray(found.data.asignacionesEntradas) ? found.data.asignacionesEntradas : []
  };
});

exports.changeOwnPassword = onCall(async (request) => {
  const oldPass = String(request.data?.oldPass || "");
  const newPass = String(request.data?.newPass || "").trim();
  if (!oldPass || !newPass) throw new HttpsError("invalid-argument", "Datos incompletos.");
  if (newPass.length < 4) throw new HttpsError("failed-precondition", "La nueva contraseña es demasiado corta.");

  const s = await resolveSession(request, true);
  if (!s?.username) throw new HttpsError("unauthenticated", "Debe iniciar sesión.");

  if (s.collaborator) {
    const colId = `${s.owner}__${s.username}`;
    const colRef = db.collection("autorizaciones").doc(colId);
    const colDoc = await colRef.get();
    if (!colDoc.exists) throw new HttpsError("not-found", "Colaborador no encontrado.");
    const colData = colDoc.data() || {};
    if (!isPasswordMatch(colData.pass, oldPass)) {
      throw new HttpsError("permission-denied", "La contraseña actual es incorrecta.");
    }
    await colRef.set({
      pass: newPass,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, username: s.username, role: "colaborador" };
  }

  const ownerEntry = await getOwnerDoc(s.username);
  const ownerData = ownerEntry?.data || {};
  const currentPass = String(ownerData.pass || "");
  if (!isPasswordMatch(currentPass, oldPass)) {
    throw new HttpsError("permission-denied", "La contraseña actual es incorrecta.");
  }
  const ownerId = ownerEntry?.id || s.username;
  await db.collection("owners").doc(ownerId).set({
    username: norm(s.username),
    pass: newPass,
    activo: ownerData.activo !== false,
    estado: String(ownerData.estado || "activo"),
    empresa: String(ownerData.empresa || (norm(s.username) === MASTER_USER ? "MASTER" : "")),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, username: s.username, role: s.superMaster ? "super-master" : "admin" };
});

exports.updateSessionPresence = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (!s?.username) throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
  const online = request.data?.online !== false;
  await writeSessionPresence(s, online);
  return { ok: true, online };
});

exports.registerBusiness = onCall(PAYPAL_RUNTIME_OPTS, async (request) => {
  const businessName = safeText(request.data?.businessName, 120);
  const adminName = safeText(request.data?.adminName, 120);
  const firstName = safeText(request.data?.firstName, 120);
  const lastName = safeText(request.data?.lastName, 120);
  const cedula = safeText(request.data?.cedula, 40);
  const email = norm(request.data?.email);
  const phone = safeText(request.data?.phone, 30);
  const password = String(request.data?.password || "").trim();
  const planReq = norm(request.data?.plan) || "basico";
  const planCfg = PLAN_CATALOG[planReq] || PLAN_CATALOG.basico;
  const plan = planCfg.id;
  const billingDay = normalizeBillingDay(request.data?.billingDay);
  const paypalPlanId = await getPlanIdForKey(plan, false);

  if (!businessName || !adminName || !email || !phone || !password) {
    throw new HttpsError("invalid-argument", "Datos incompletos para registro.");
  }

  if (!firstName || !lastName || !cedula) {
    throw new HttpsError("invalid-argument", "Datos incompletos para registro.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Correo electrónico inválido.");
  }

  const ownerUsername = email;
  if (ownerUsername === MASTER_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");

  const ownerDoc = await getOwnerDoc(ownerUsername);
  if (ownerDoc && ownerDoc.data?.activo !== false) {
    throw new HttpsError("already-exists", "Ya existe una cuenta con ese correo.");
  }

  const negocioId = businessIdFromName(businessName);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection("negocios").doc(negocioId).set({
    negocioId,
    nombre: businessName,
    plan,
    estado: "inactivo",
    owner: ownerUsername,
    adminName,
    firstName,
    lastName,
    cedula,
    email,
    phone,
    clienteRegistro: {
      nombre: firstName,
      apellido: lastName,
      cedula,
      telefono: phone
    },
    limites: {
      usuariosMax: planCfg.usuariosMax,
      modulosMax: planCfg.modulosMax,
      sucursalesMax: planCfg.sucursalesMax
    },
    suscripcion: {
      estado: "pending",
      paypalReceiver: PAYPAL_RECEIVER,
      paypalPlanId,
      montoUSD: planCfg.montoUSD,
      billingDay: billingDay || null
    },
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  await db.collection("owners").doc(ownerUsername).set({
    username: ownerUsername,
    pass: password,
    empresa: businessName,
    negocioId,
    adminName,
    firstName,
    lastName,
    cedula,
    email,
    phone,
    plan,
    estado: "inactivo",
    limites: {
      usuariosMax: planCfg.usuariosMax,
      modulosMax: planCfg.modulosMax,
      sucursalesMax: planCfg.sucursalesMax
    },
    suscripcion: {
      estado: "pending",
      paypalReceiver: PAYPAL_RECEIVER,
      paypalPlanId,
      montoUSD: planCfg.montoUSD,
      billingDay: billingDay || null
    },
    activo: true,
    clienteRegistro: {
      nombre: firstName,
      apellido: lastName,
      cedula,
      telefono: phone
    },
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  await db.collection("clientes_registro").doc(ownerUsername).set({
    owner: ownerUsername,
    negocioId,
    nombre: firstName,
    apellido: lastName,
    cedula,
    telefono: phone,
    email,
    adminName,
    plan,
    paypalPlanId,
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  const seed = createTenantDbSeed(ownerUsername, negocioId, businessName);
  await db.collection("datos_del_propietario").doc(ownerUsername).set({
    owner: ownerUsername,
    negocioId,
    db: seed,
    "base de datos": seed,
    updatedAt: now,
    updatedAtClient: Date.now(),
    syncKey: `register-${Date.now()}`,
    updatedBy: ownerUsername,
    updatedFrom: "register-business"
  }, { merge: true });

  const paymentUrl = "";
  const paymentProvider = "paypal_subscription";
  return {
    ok: true,
    negocioId,
    username: ownerUsername,
    owner: ownerUsername,
    plan,
    billingDay: billingDay || null,
    paypalPlanId,
    planInfo: planCfg,
    paymentUrl,
    paymentProvider,
    trialDays: 0
  };
});

exports.getPublicBillingConfig = onCall(PAYPAL_RUNTIME_OPTS, async () => {
  const clientId = getPaypalClientId();
  let productId = "";
  let planIds = await loadPayPalPlanIds();
  const missingCore = ["basico", "profesional", "empresarial"].some((k) => !safeText(planIds[k], 120));
  if (missingCore && getPaypalClientSecret()) {
    const ensured = await ensurePayPalCatalog();
    productId = safeText(ensured?.productId, 80);
    planIds = ensured?.planIds || planIds;
  } else if (missingCore) {
    const rawProduct = safeText(process.env.PAYPAL_PRODUCT_ID || "", 80);
    productId = /^MISSING/i.test(rawProduct) ? "" : rawProduct;
  }
  return {
    ok: true,
    paypalClientId: clientId,
    paypalMeUser: PAYPAL_ME_USER,
    paypalReceiver: PAYPAL_RECEIVER,
    productName: PAYPAL_PRODUCT_NAME,
    productId: safeText(productId, 80),
    planIds,
    currency: "USD",
    mode: "LIVE"
  };
});

exports.ensurePaypalCatalog = onCall(PAYPAL_RUNTIME_OPTS, async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true && s.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo usuarios administradores.");
  }
  const data = await ensurePayPalCatalog();
  return { ok: true, ...data };
});

exports.confirmPaypalSubscriptionApproval = onCall(PAYPAL_RUNTIME_OPTS, async (request) => {
  const owner = norm(request.data?.owner);
  const negocioId = safeText(request.data?.negocioId, 120);
  const plan = norm(request.data?.plan) || "basico";
  const subscriptionId = safeText(request.data?.subscriptionId, 120);
  const password = String(request.data?.password || "");
  if (!owner || !subscriptionId) {
    throw new HttpsError("invalid-argument", "Datos incompletos para confirmar suscripción.");
  }

  const ownerEntry = await getOwnerDoc(owner);
  if (!ownerEntry) throw new HttpsError("not-found", "Cuenta no encontrada.");
  if (!isPasswordMatch(ownerEntry.data?.pass, password)) {
    throw new HttpsError("permission-denied", "No autorizado para activar esta cuenta.");
  }

  const details = await getPayPalSubscription(subscriptionId);
  const subStatus = normalizeSubState(details?.status);
  const paypalPlanId = safeText(details?.plan_id, 120);
  const nextBillingTime = safeText(details?.billing_info?.next_billing_time, 60);
  const billingDay = billingDayFromDate(nextBillingTime);
  const payerEmail = safeText(details?.subscriber?.email_address || ownerEntry.data?.email, 160);
  const amountUSD = Number(details?.billing_info?.last_payment?.amount?.value || PLAN_CATALOG[plan]?.montoUSD || 0);

  await setBusinessSubscriptionState({
    owner,
    negocioId,
    plan,
    status: subStatus,
    provider: "paypal_subscription_sdk",
    amountUSD,
    subscriptionId,
    paypalPlanId,
    payerEmail,
    paymentRef: safeText(details?.id, 120),
    nextBillingTime,
    billingDay,
    eventType: subStatus === "active" ? "BILLING.SUBSCRIPTION.ACTIVATED" : "BILLING.SUBSCRIPTION.PENDING",
    writeNotification: subStatus === "active"
  });

  return {
    ok: true,
    owner,
    negocioId,
    plan,
    subscriptionId,
    status: subStatus
  };
});

exports.confirmPaypalBusinessPayment = onCall(PAYPAL_RUNTIME_OPTS, async (request) => {
  const owner = norm(request.data?.owner);
  const negocioId = safeText(request.data?.negocioId, 120);
  const plan = norm(request.data?.plan) || "basico";
  const orderId = safeText(request.data?.orderId, 120);
  const password = String(request.data?.password || "");
  if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");

  const ownerEntry = await getOwnerDoc(owner);
  if (!ownerEntry) throw new HttpsError("not-found", "Cuenta no encontrada.");
  if (!isPasswordMatch(ownerEntry.data?.pass, password)) {
    throw new HttpsError("permission-denied", "No autorizado para activar esta cuenta.");
  }

  const planCfg = PLAN_CATALOG[plan] || PLAN_CATALOG.basico;
  let montoUSD = Number(planCfg.montoUSD || 0);
  let payerEmail = "";
  let provider = "paypal_client_capture";

  if (orderId && getPaypalClientSecret()) {
    const order = await getPayPalOrder(orderId);
    const status = String(order?.status || "").toUpperCase();
    if (status !== "COMPLETED") {
      throw new HttpsError("failed-precondition", "La orden PayPal no está completada.");
    }
    const pu = Array.isArray(order?.purchase_units) ? order.purchase_units[0] : null;
    const amountValue = Number(pu?.amount?.value || montoUSD);
    const currency = String(pu?.amount?.currency_code || "USD").toUpperCase();
    if (currency !== "USD") throw new HttpsError("failed-precondition", "Moneda de pago inválida.");
    if (Math.abs(amountValue - Number(planCfg.montoUSD || 0)) > 0.01) {
      throw new HttpsError("failed-precondition", "Monto de pago no coincide con el plan.");
    }
    montoUSD = amountValue;
    payerEmail = safeText(order?.payer?.email_address, 160);
    provider = "paypal_api_verified";
  }

  return activateBusinessSubscription({
    owner,
    negocioId,
    plan,
    provider,
    montoUSD,
    paymentRef: orderId,
    payerEmail
  });
});

exports.createMembershipCheckout = onCall(PAYPAL_RUNTIME_OPTS, async (request) => {
  const s = await resolveSession(request, true);
  if (s.collaborator === true) throw new HttpsError("permission-denied", "Solo usuario maestro.");
  const owner = norm(s.owner || request.data?.owner);
  if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
  const ownerEntry = await getOwnerDoc(owner);
  if (!ownerEntry) throw new HttpsError("not-found", "Cuenta no encontrada.");
  if (ownerEntry.data?.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);

  const planReq = norm(request.data?.plan) || "basico";
  const planCfg = PLAN_CATALOG[planReq] || PLAN_CATALOG.basico;
  const plan = planCfg.id;
  const paypalPlanId = await getPlanIdForKey(plan);
  const billingDay = normalizeBillingDay(request.data?.billingDay);
  const negocioId = safeText(ownerEntry.data?.negocioId, 120);
  if (!negocioId) throw new HttpsError("failed-precondition", "Negocio no configurado.");

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection("owners").doc(ownerEntry.id).set({
    plan,
    updatedAt: now,
    suscripcion: {
      ...(ownerEntry.data?.suscripcion || {}),
      estado: "pending",
      montoUSD: planCfg.montoUSD,
      paypalPlanId,
      billingDay: billingDay || null,
      cambioPendientePlan: plan
    }
  }, { merge: true });

  await db.collection("negocios").doc(negocioId).set({
    plan,
    updatedAt: now,
    suscripcion: {
      ...(ownerEntry.data?.suscripcion || {}),
      estado: "pending",
      montoUSD: planCfg.montoUSD,
      paypalPlanId,
      billingDay: billingDay || null,
      cambioPendientePlan: plan
    }
  }, { merge: true });

  await emitMasterNotification({
    type: "subscription_payment_pending",
    owner,
    negocioId,
    plan,
    paymentStatus: "pending_payment",
    amountUSD: Number(planCfg.montoUSD || 0)
  });

  const paypalUrl = buildPaypalLink({ plan, negocioId, owner });
  const paymentUrl = paypalUrl;
  const paymentProvider = "paypal";
  return {
    ok: true,
    owner,
    negocioId,
    plan,
    paypalPlanId,
    billingDay: billingDay || null,
    planInfo: planCfg,
    paymentProvider,
    paymentUrl,
    paypalUrl
  };
});

exports.paypalWebhook = onRequest(PAYPAL_RUNTIME_OPTS, async (req, res) => {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, endpoint: "paypalWebhook", configured: !!PAYPAL_WEBHOOK_ID });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    const event = (req.body && typeof req.body === "object") ? req.body : {};
    const eventType = safeText(event?.event_type, 80);
    const resource = event?.resource || {};
    const verified = await verifyPayPalWebhook(req, event);
    if (!verified) {
      res.status(401).json({ ok: false, message: "Webhook no verificado." });
      return;
    }

    const subscriptionId = safeText(
      resource?.id ||
      resource?.billing_agreement_id ||
      resource?.supplementary_data?.related_ids?.subscription_id,
      120
    );
    let subDoc = null;
    if (subscriptionId) {
      subDoc = await db.collection("paypal_subscriptions").doc(subscriptionId).get();
    }

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const details = subscriptionId ? await getPayPalSubscription(subscriptionId) : {};
      const custom = parseCustomId(details?.custom_id || resource?.custom_id || "");
      const owner = custom.owner || norm(subDoc?.data()?.owner);
      const negocioId = custom.negocioId || safeText(subDoc?.data()?.negocioId, 120);
      const plan = await resolvePlanKeyFromPaypalPlanId(details?.plan_id || resource?.plan_id, custom.plan || subDoc?.data()?.plan || "basico");
      const nextBillingTime = safeText(details?.billing_info?.next_billing_time, 60);
      const payerEmail = safeText(details?.subscriber?.email_address || subDoc?.data()?.payerEmail, 160);
      const amount = Number(details?.billing_info?.last_payment?.amount?.value || PLAN_CATALOG[plan]?.montoUSD || 0);
      await setBusinessSubscriptionState({
        owner,
        negocioId,
        plan,
        status: "active",
        provider: "paypal_webhook",
        amountUSD: amount,
        subscriptionId,
        paypalPlanId: safeText(details?.plan_id || resource?.plan_id, 120),
        payerEmail,
        paymentRef: safeText(resource?.id, 120),
        nextBillingTime,
        billingDay: billingDayFromDate(nextBillingTime),
        eventType,
        writeNotification: false
      });
    } else if (eventType === "PAYMENT.SALE.COMPLETED") {
      const owner = norm(subDoc?.data()?.owner);
      const negocioId = safeText(subDoc?.data()?.negocioId, 120);
      const plan = norm(subDoc?.data()?.plan || "basico");
      const amount = Number(resource?.amount?.total || resource?.amount?.value || PLAN_CATALOG[plan]?.montoUSD || 0);
      const paidAt = safeText(resource?.create_time, 60);
      const paymentRef = safeText(resource?.id, 120);
      await setBusinessSubscriptionState({
        owner,
        negocioId,
        plan,
        status: "active",
        provider: "paypal_webhook",
        amountUSD: amount,
        subscriptionId,
        paypalPlanId: safeText(subDoc?.data()?.paypalPlanId, 120),
        payerEmail: safeText(subDoc?.data()?.payerEmail, 160),
        paymentRef,
        nextBillingTime: safeText(subDoc?.data()?.nextBillingTime, 60),
        billingDay: Number(subDoc?.data()?.billingDay || 0) || null,
        eventType,
        writeNotification: true
      });
      if (subscriptionId) {
        await db.collection("paypal_subscriptions").doc(subscriptionId).set({
          lastPaymentAtIso: paidAt,
          lastPaymentRef: paymentRef,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      await db.collection("subscription_payments").add({
        owner,
        negocioId,
        plan,
        subscriptionId,
        amountUSD: amount,
        currency: safeText(resource?.amount?.currency || "USD", 10),
        status: "completed",
        paymentRef,
        eventType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAtIso: paidAt
      });
    } else if (eventType === "PAYMENT.SALE.DENIED") {
      const owner = norm(subDoc?.data()?.owner);
      const negocioId = safeText(subDoc?.data()?.negocioId, 120);
      const plan = norm(subDoc?.data()?.plan || "basico");
      await setBusinessSubscriptionState({
        owner,
        negocioId,
        plan,
        status: "failed",
        provider: "paypal_webhook",
        amountUSD: Number(subDoc?.data()?.amountUSD || PLAN_CATALOG[plan]?.montoUSD || 0),
        subscriptionId,
        paypalPlanId: safeText(subDoc?.data()?.paypalPlanId, 120),
        payerEmail: safeText(subDoc?.data()?.payerEmail, 160),
        paymentRef: safeText(resource?.id, 120),
        nextBillingTime: safeText(subDoc?.data()?.nextBillingTime, 60),
        billingDay: Number(subDoc?.data()?.billingDay || 0) || null,
        eventType,
        writeNotification: true
      });
    } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
      const owner = norm(subDoc?.data()?.owner);
      const negocioId = safeText(subDoc?.data()?.negocioId, 120);
      const plan = norm(subDoc?.data()?.plan || "basico");
      await setBusinessSubscriptionState({
        owner,
        negocioId,
        plan,
        status: "cancelled",
        provider: "paypal_webhook",
        amountUSD: Number(subDoc?.data()?.amountUSD || PLAN_CATALOG[plan]?.montoUSD || 0),
        subscriptionId,
        paypalPlanId: safeText(subDoc?.data()?.paypalPlanId, 120),
        payerEmail: safeText(subDoc?.data()?.payerEmail, 160),
        paymentRef: safeText(resource?.id, 120),
        nextBillingTime: "",
        billingDay: Number(subDoc?.data()?.billingDay || 0) || null,
        eventType,
        writeNotification: true
      });
    }

    await db.collection("paypal_webhook_events").doc(safeText(event?.id, 120) || `${Date.now()}`).set({
      eventType,
      resourceId: safeText(resource?.id, 120),
      subscriptionId,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: safeText(e?.message || "Webhook error", 240) });
  }
});

exports.stripeWebhook = onRequest(async (_req, res) => {
  res.status(410).json({ ok: false, message: "Stripe deshabilitado. Este sistema usa únicamente PayPal." });
});

exports.createMasterUser = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");

  const username = norm(request.data?.username);
  const pass = String(request.data?.pass || "").trim();
  const empresa = String(request.data?.empresa || "").trim();
  if (!username || !pass) throw new HttpsError("invalid-argument", "Datos incompletos.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");

  await db.collection("owners").doc(username).set({
    username,
    pass,
    empresa,
    estado: "activo",
    plan: "delegado",
    dependenciaPago: "master",
    parentOwner: norm(s.username || MASTER_USER),
    suscripcion: { estado: "activa", proveedor: "master_delegada", delegada: true, montoUSD: 0, parentOwner: norm(s.username || MASTER_USER) },
    activo: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || "")
  }, { merge: true });
  return { ok: true, username };
});

exports.setMasterStatus = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const username = norm(request.data?.username);
  const activo = request.data?.activo !== false;
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede suspender super master.");
  if (!(s.superMaster === true || norm(s.owner) === username)) throw new HttpsError("permission-denied", "Sin permisos.");

  await db.collection("owners").doc(username).set({
    username,
    activo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const q = await db.collection("autorizaciones").where("owner", "==", username).get();
  const batch = db.batch();
  q.forEach((d) => batch.set(d.ref, { activo, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
  if (!q.empty) await batch.commit();
  return { ok: true, username, activo, collaborators: q.size };
});

exports.deleteMasterAccount = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede eliminar super master.");

  const dels = [];
  dels.push(db.collection("owners").doc(username).delete());
  dels.push(db.collection("datos_del_propietario").doc(username).delete());
  const q = await db.collection("autorizaciones").where("owner", "==", username).get();
  q.forEach((d) => dels.push(d.ref.delete()));
  await Promise.all(dels);
  return { ok: true, username, collaboratorsDeleted: q.size };
});

exports.createTeamMember = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  const pass = String(request.data?.pass || "").trim();
  const permisosReq = Array.isArray(request.data?.permisos) ? request.data.permisos : ["home", "salida"];
  const permisos = sanitizeCollaboratorPerms(permisosReq, owner);
  const asignacionesEntradas = Array.isArray(request.data?.asignacionesEntradas) ? request.data.asignacionesEntradas : [];
  const activo = request.data?.activo !== false;
  if (!username || !pass) throw new HttpsError("invalid-argument", "Datos incompletos.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");

  const ownerExists = await getOwnerDoc(username);
  if (ownerExists) throw new HttpsError("already-exists", "Ese username pertenece a un maestro.");

  const docId = `${owner}__${username}`;
  const prev = await db.collection("autorizaciones").doc(docId).get();
  const prevData = prev.data() || {};
  const createdAt = prev.exists
    ? (prevData.createdAt || prevData.updatedAt || admin.firestore.FieldValue.serverTimestamp())
    : admin.firestore.FieldValue.serverTimestamp();
  await db.collection("autorizaciones").doc(docId).set({
    owner,
    username,
    pass,
    role: "colaborador",
    activo,
    permisos: Array.from(new Set(permisos)),
    asignacionesEntradas: Array.from(new Set(asignacionesEntradas)),
    createdAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || owner)
  }, { merge: true });
  return { ok: true, owner, username };
});

exports.listMasterUsers = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const isSuper = s.superMaster === true;
  const owner = norm(s.owner);
  const owners = [];

  if (isSuper) {
    const snap = await db.collection("owners").get();
    let hasMaster = false;
    let foundForcedRemovedOwner = false;
    snap.forEach((d) => {
      const data = d.data() || {};
      const uname = norm(data.username || d.id);
      if (uname === FORCED_REMOVED_USER) {
        foundForcedRemovedOwner = true;
        return;
      }
      if (uname === MASTER_USER) hasMaster = true;
      owners.push({
        username: uname,
        pass: String(data.pass || ""),
        empresa: String(data.empresa || ""),
        activo: data.activo !== false,
        plan: String(data.plan || "basico"),
        estado: String(data.estado || "activo"),
        suscripcion: data.suscripcion || null
      });
    });
    if (foundForcedRemovedOwner) {
      await db.collection("owners").doc(FORCED_REMOVED_USER).delete();
      await db.collection("datos_del_propietario").doc(FORCED_REMOVED_USER).delete();
      const q = await db.collection("autorizaciones").where("owner", "==", FORCED_REMOVED_USER).get();
      const batch = db.batch();
      q.forEach((d) => batch.delete(d.ref));
      if (!q.empty) await batch.commit();
    }
    if (!hasMaster) {
      owners.push({
        username: MASTER_USER,
        pass: MASTER_PASS,
        empresa: "MASTER",
        activo: true,
        plan: "empresarial",
        estado: "activo",
        suscripcion: {
          estado: "activa",
          proveedor: "master",
          montoUSD: 0
        }
      });
    }
  } else if (owner) {
    await assertOwnerActive(owner);
    const o = await getOwnerDoc(owner);
    if (o) {
      owners.push({
        username: norm(o.data.username || o.id),
        pass: String(o.data.pass || ""),
        empresa: String(o.data.empresa || ""),
        activo: o.data.activo !== false,
        plan: String(o.data.plan || "basico"),
        estado: String(o.data.estado || "activo"),
        suscripcion: o.data.suscripcion || null
      });
    }
  }

  return { ok: true, owners };
});

exports.listTeamMembers = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const ownerReq = norm(request.data?.owner);
  const owner = s.superMaster === true
    ? (ownerReq || norm(s.owner))
    : norm(s.owner);
  if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
  if (owner === FORCED_REMOVED_USER) return { ok: true, owner, collaborators: [] };
  await assertOwnerActive(owner);

  const q = await db.collection("autorizaciones").where("owner", "==", owner).get();
  const collaborators = [];
  q.forEach((d) => {
    const it = d.data() || {};
    const username = norm(it.username || d.id.split("__")[1] || "");
    if (!username || username === FORCED_REMOVED_USER) return;
    collaborators.push({
      owner,
      username,
      pass: String(it.pass || ""),
      role: "colaborador",
      activo: it.activo !== false,
      createdAt: tsToIso(it.createdAt || it.updatedAt),
      updatedAt: tsToIso(it.updatedAt),
      permisos: sanitizeCollaboratorPerms(Array.isArray(it.permisos) ? it.permisos : ["home", "salida"], owner),
      asignacionesEntradas: Array.isArray(it.asignacionesEntradas) ? Array.from(new Set(it.asignacionesEntradas)) : []
    });
  });
  return { ok: true, owner, collaborators };
});

exports.getMasterVaultOverview = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");

  const ownersSnap = await db.collection("owners").get();
  const teamSnap = await db.collection("autorizaciones").get();
  const collabCountByOwner = new Map();

  teamSnap.forEach((d) => {
    const item = d.data() || {};
    const owner = norm(item.owner);
    if (!owner || owner === FORCED_REMOVED_USER) return;
    collabCountByOwner.set(owner, Number(collabCountByOwner.get(owner) || 0) + 1);
  });

  const owners = [];
  let hasMaster = false;
  ownersSnap.forEach((d) => {
    const data = d.data() || {};
    const username = norm(data.username || d.id);
    if (!username || username === FORCED_REMOVED_USER) return;
    if (username === MASTER_USER) hasMaster = true;
    const createdAtIso = tsToIso(data.createdAt);
    const updatedAtIso = tsToIso(data.updatedAt);
    owners.push({
      username,
      empresa: safeText(data.empresa, 120),
      activo: data.activo !== false,
      estado: safeText(data.estado || "activo", 40),
      plan: safeText(data.plan || "basico", 40),
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      online: isPresenceOnline(data),
      presenceUpdatedAt: tsToIso(data.presenceUpdatedAt),
      collaboratorsCount: Number(collabCountByOwner.get(username) || 0),
      suscripcion: data.suscripcion || null
    });
  });

  if (!hasMaster) {
    owners.push({
      username: MASTER_USER,
      empresa: "MASTER",
      activo: true,
      estado: "activo",
      plan: "empresarial",
      createdAt: "",
      updatedAt: "",
      online: false,
      presenceUpdatedAt: "",
      collaboratorsCount: Number(collabCountByOwner.get(MASTER_USER) || 0),
      suscripcion: { estado: "activa", proveedor: "master", montoUSD: 0 }
    });
  }

  owners.sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));
  return { ok: true, owners };
});

exports.setTeamMemberStatus = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  const activo = request.data?.activo !== false;
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).set({
    owner,
    username,
    activo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || owner)
  }, { merge: true });
  return { ok: true, owner, username, activo };
});

exports.deleteTeamMember = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).delete();
  return { ok: true, owner, username };
});

exports.purgeTeamMemberHard = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const ownerReq = norm(request.data?.owner);
  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");

  const owner = s.superMaster === true ? ownerReq : norm(s.owner);
  if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
  if (s.superMaster !== true && (s.role !== "admin" && s.role !== "super-master")) {
    throw new HttpsError("permission-denied", "Sin permisos.");
  }
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede eliminar super master.");
  await assertOwnerActive(owner);

  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).delete();
  await scrubCollaboratorReferences(owner, username);

  return { ok: true, owner, username, hardDeleted: true };
});

exports.purgeMasterAccountHard = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede eliminar super master.");

  const ownerEntry = await getOwnerDoc(username);
  const negocioId = safeText(ownerEntry?.data?.negocioId, 120);

  const teamDeleted = await deleteByQuery(db.collection("autorizaciones").where("owner", "==", username));
  const teamRefsDeleted = await deleteByQuery(db.collection("autorizaciones").where("username", "==", username));
  const negocioOwnerDeleted = await deleteByQuery(db.collection("negocios").where("owner", "==", username));
  const notifDeleted = await deleteByQuery(db.collection("notificaciones_master").where("owner", "==", username));

  const deletes = [
    db.collection("owners").doc(username).delete(),
    db.collection("datos_del_propietario").doc(username).delete(),
    db.collection("clientes_registro").doc(username).delete()
  ];
  if (negocioId) deletes.push(db.collection("negocios").doc(negocioId).delete());
  await Promise.all(deletes);

  return {
    ok: true,
    username,
    hardDeleted: true,
    teamDeleted,
    teamRefsDeleted,
    negocioOwnerDeleted,
    notificationsDeleted: notifDeleted
  };
});

exports.listMasterPaymentNotifications = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const limitReq = Number(request.data?.limit || 80);
  const limit = Number.isFinite(limitReq) ? Math.max(1, Math.min(200, Math.trunc(limitReq))) : 80;
  const snap = await db.collection("notificaciones_master").orderBy("createdAt", "desc").limit(limit).get();
  const items = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    items.push({
      id: d.id,
      type: safeText(data.type, 80),
      owner: norm(data.owner),
      negocioId: safeText(data.negocioId, 120),
      plan: safeText(data.plan, 40),
      paymentStatus: safeText(data.paymentStatus, 60),
      paymentRef: safeText(data.paymentRef, 120),
      amountUSD: Number(data.amountUSD || 0),
      payerEmail: safeText(data.payerEmail, 160),
      read: data.read === true,
      createdAt: tsToIso(data.createdAt)
    });
  });
  return { ok: true, notifications: items };
});

exports.getMasterControlSummary = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");

  const [ownersSnap, teamSnap, clientsSnap, notifSnap, ownerDataSnap] = await Promise.all([
    db.collection("owners").get(),
    db.collection("autorizaciones").get(),
    db.collection("clientes_registro").get(),
    db.collection("notificaciones_master").get(),
    db.collection("datos_del_propietario").get()
  ]);

  let totalOwners = 0;
  let suscripcionesActivas = 0;
  let pagosPendientes = 0;
  let pagosFallidos = 0;
  ownersSnap.forEach((d) => {
    const o = d.data() || {};
    const u = norm(o.username || d.id);
    if (!u || u === FORCED_REMOVED_USER) return;
    totalOwners++;
    const subEstado = normalizeSubState(o?.suscripcion?.estado || o?.estado);
    if (subEstado === "active") suscripcionesActivas++;
    if (subEstado === "pending" || subEstado === "failed") pagosPendientes++;
    if (subEstado === "failed" || subEstado === "fallida") pagosFallidos++;
  });
  if (!ownersSnap.docs.some((d) => norm(d.data()?.username || d.id) === MASTER_USER)) {
    totalOwners++;
    suscripcionesActivas++;
  }

  const totalColaboradores = teamSnap.size;
  const totalClientesRegistro = clientsSnap.size;

  let totalClientesFidelizacion = 0;
  ownerDataSnap.forEach((d) => {
    const data = d.data() || {};
    const payload = (data.db && typeof data.db === "object") ? data.db : (data["base de datos"] || {});
    const list = Array.isArray(payload?.clientesFidelizacion) ? payload.clientesFidelizacion : [];
    const valid = list.filter((c) => {
      const nombre = String(c?.nombre || c?.name || "").trim().toLowerCase();
      if (!nombre) return false;
      if (nombre === "consumidor final") return false;
      const cedula = String(c?.cedula || "").replace(/\D/g, "");
      const rnc = String(c?.rnc || "").replace(/\D/g, "");
      const telefono = String(c?.telefono || c?.phone || "").replace(/\D/g, "");
      const codigo = String(c?.codigo || c?.id || "").trim();
      return !!(cedula || rnc || telefono || codigo);
    });
    totalClientesFidelizacion += valid.length;
  });

  let pagosRealizados = 0;
  notifSnap.forEach((d) => {
    const n = d.data() || {};
    const type = norm(n.type);
    const pStatus = norm(n.paymentStatus);
    if (type === "subscription_payment_confirmed" || pStatus === "paid" || pStatus === "payment.sale.completed" || pStatus === "active") pagosRealizados++;
    if (pStatus === "pending_payment" || pStatus === "pending" || pStatus === "payment.sale.denied" || pStatus === "failed") pagosPendientes++;
    if (pStatus === "failed" || pStatus === "fallida") pagosFallidos++;
  });

  return {
    ok: true,
    stats: {
      totalOwners,
      totalCollaborators: totalColaboradores,
      totalClientsRegistered: totalClientesRegistro,
      totalClientsFidelizacion: totalClientesFidelizacion,
      totalActiveSubscriptions: suscripcionesActivas,
      totalPaymentsDone: pagosRealizados,
      totalPaymentsPending: pagosPendientes,
      totalPaymentsFailed: pagosFallidos
    }
  };
});

exports.getMasterControlDetails = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const type = safeText(request.data?.type, 40);
  if (!type) throw new HttpsError("invalid-argument", "Tipo requerido.");

  if (type === "owners") {
    const snap = await db.collection("owners").get();
    const items = [];
    snap.forEach((d) => {
      const o = d.data() || {};
      const username = norm(o.username || d.id);
      if (!username || username === FORCED_REMOVED_USER) return;
      items.push({
        id: username,
        username,
        empresa: safeText(o.empresa || "", 160),
        activo: o.activo !== false,
        estado: safeText(o.estado || "activo", 40),
        plan: safeText(o.plan || "basico", 40),
        createdAt: tsToIso(o.createdAt)
      });
    });
    return { ok: true, type, items };
  }

  if (type === "collaborators") {
    const snap = await db.collection("autorizaciones").get();
    const items = [];
    snap.forEach((d) => {
      const c = d.data() || {};
      const owner = norm(c.owner);
      const username = norm(c.username || c.user);
      if (!owner || !username) return;
      items.push({
        id: `${owner}__${username}`,
        owner,
        username,
        activo: c.activo !== false,
        createdAt: tsToIso(c.createdAt)
      });
    });
    return { ok: true, type, items };
  }

  if (type === "clients_saas") {
    const snap = await db.collection("clientes_registro").get();
    const items = [];
    snap.forEach((d) => {
      const c = d.data() || {};
      const owner = norm(c.owner || d.id);
      if (!owner) return;
      items.push({
        id: owner,
        owner,
        negocio: safeText(c.businessName || c.negocio || "", 180),
        admin: safeText(c.adminName || c.admin || "", 120),
        email: safeText(c.email || "", 160),
        phone: safeText(c.phone || "", 80),
        createdAt: tsToIso(c.createdAt)
      });
    });
    return { ok: true, type, items };
  }

  if (type === "clients_fidelizacion") {
    const snap = await db.collection("datos_del_propietario").get();
    const items = [];
    snap.forEach((d) => {
      const owner = norm(d.id);
      const data = d.data() || {};
      const payload = (data.db && typeof data.db === "object") ? data.db : (data["base de datos"] || {});
      const list = Array.isArray(payload?.clientesFidelizacion) ? payload.clientesFidelizacion : [];
      list.forEach((c, idx) => {
        const nombreRaw = String(c?.nombre || c?.name || "").trim();
        const nombre = nombreRaw.toLowerCase();
        if (!nombre || nombre === "consumidor final") return;
        const cedula = String(c?.cedula || "").replace(/\D/g, "");
        const rnc = String(c?.rnc || "").replace(/\D/g, "");
        const telefono = String(c?.telefono || c?.phone || "").replace(/\D/g, "");
        const codigo = safeText(c?.codigo || c?.id || "", 120);
        if (!(cedula || rnc || telefono || codigo)) return;
        const fidKey = safeText(c?.fidKey || c?.id || `${owner}::${cedula || rnc || telefono || nombre}::${idx}`, 240);
        items.push({
          id: fidKey,
          owner,
          nombre: nombreRaw,
          cedula,
          rnc,
          telefono,
          codigo
        });
      });
    });
    return { ok: true, type, items };
  }

  if (type === "subs_active") {
    const snap = await db.collection("owners").get();
    const items = [];
    snap.forEach((d) => {
      const o = d.data() || {};
      const username = norm(o.username || d.id);
      if (!username || username === FORCED_REMOVED_USER) return;
      const subEstado = normalizeSubState(o?.suscripcion?.estado || o?.estado);
      if (subEstado !== "active") return;
      items.push({
        id: username,
        owner: username,
        plan: safeText(o?.suscripcion?.plan || o?.plan || "basico", 40),
        estado: safeText(o?.suscripcion?.estado || o?.estado || "active", 40),
        nextChargeAt: tsToIso(o?.suscripcion?.nextChargeAt || o?.billing?.nextChargeAt)
      });
    });
    return { ok: true, type, items };
  }

  if (type === "pay_done" || type === "pay_pending" || type === "pay_failed") {
    const snap = await db.collection("notificaciones_master").orderBy("createdAt", "desc").limit(400).get();
    const items = [];
    snap.forEach((d) => {
      const n = d.data() || {};
      const pStatus = norm(n.paymentStatus);
      const nType = norm(n.type);
      const isDone = nType === "subscription_payment_confirmed" || pStatus === "paid" || pStatus === "payment.sale.completed" || pStatus === "active";
      const isPending = pStatus === "pending_payment" || pStatus === "pending" || pStatus === "payment.sale.denied" || pStatus === "failed";
      const isFailed = pStatus === "failed" || pStatus === "fallida";
      if (type === "pay_done" && !isDone) return;
      if (type === "pay_pending" && !isPending) return;
      if (type === "pay_failed" && !isFailed) return;
      items.push({
        id: d.id,
        owner: norm(n.owner),
        plan: safeText(n.plan || "", 40),
        paymentStatus: safeText(n.paymentStatus || "", 60),
        amountUSD: Number(n.amountUSD || 0),
        createdAt: tsToIso(n.createdAt)
      });
    });
    return { ok: true, type, items };
  }

  throw new HttpsError("invalid-argument", "Tipo no soportado.");
});

exports.deleteMasterControlDetail = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const type = safeText(request.data?.type, 40);
  if (!type) throw new HttpsError("invalid-argument", "Tipo requerido.");

  if (type === "owners") {
    const username = norm(request.data?.username || request.data?.id);
    if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
    if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede eliminar super master.");
    const ownerEntry = await getOwnerDoc(username);
    const negocioId = safeText(ownerEntry?.data?.negocioId, 120);
    await Promise.all([
      deleteByQuery(db.collection("autorizaciones").where("owner", "==", username)),
      deleteByQuery(db.collection("autorizaciones").where("username", "==", username)),
      deleteByQuery(db.collection("negocios").where("owner", "==", username)),
      deleteByQuery(db.collection("notificaciones_master").where("owner", "==", username)),
      db.collection("owners").doc(username).delete(),
      db.collection("datos_del_propietario").doc(username).delete(),
      db.collection("clientes_registro").doc(username).delete(),
      negocioId ? db.collection("negocios").doc(negocioId).delete() : Promise.resolve()
    ]);
    return { ok: true, type, deleted: username };
  }

  if (type === "collaborators") {
    const owner = norm(request.data?.owner);
    const username = norm(request.data?.username);
    if (!owner || !username) throw new HttpsError("invalid-argument", "Owner y username requeridos.");
    const docId = `${owner}__${username}`;
    await db.collection("autorizaciones").doc(docId).delete();
    await scrubCollaboratorReferences(owner, username);
    return { ok: true, type, deleted: docId };
  }

  if (type === "clients_saas") {
    const owner = norm(request.data?.owner || request.data?.id);
    if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
    await db.collection("clientes_registro").doc(owner).delete();
    return { ok: true, type, deleted: owner };
  }

  if (type === "clients_fidelizacion") {
    const owner = norm(request.data?.owner);
    const fidKey = safeText(request.data?.id || request.data?.fidKey, 240);
    if (!owner || !fidKey) throw new HttpsError("invalid-argument", "Owner e id requeridos.");
    const ref = db.collection("datos_del_propietario").doc(owner);
    const doc = await ref.get();
    if (!doc.exists) return { ok: true, type, deleted: fidKey };
    const data = doc.data() || {};
    const payload = (data.db && typeof data.db === "object") ? data.db : (data["base de datos"] || {});
    const list = Array.isArray(payload?.clientesFidelizacion) ? payload.clientesFidelizacion : [];
    const filtered = list.filter((c, idx) => {
      const nombre = String(c?.nombre || c?.name || "").trim().toLowerCase();
      const cedula = String(c?.cedula || "").replace(/\D/g, "");
      const rnc = String(c?.rnc || "").replace(/\D/g, "");
      const telefono = String(c?.telefono || c?.phone || "").replace(/\D/g, "");
      const codigo = safeText(c?.codigo || c?.id || "", 120);
      const key = safeText(c?.fidKey || c?.id || `${owner}::${cedula || rnc || telefono || nombre}::${idx}`, 240);
      return key !== fidKey;
    });
    payload.clientesFidelizacion = filtered;
    await ref.set({
      owner,
      db: payload,
      "base de datos": payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtClient: Date.now(),
      syncKey: `delete-fid-${Date.now()}`,
      updatedFrom: "deleteMasterControlDetail"
    }, { merge: true });
    return { ok: true, type, deleted: fidKey };
  }

  if (type === "subs_active") {
    const owner = norm(request.data?.owner || request.data?.id);
    if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
    if (owner === MASTER_USER) throw new HttpsError("failed-precondition", "No permitido para super master.");
    await db.collection("owners").doc(owner).set({
      activo: false,
      estado: "inactivo",
      suscripcion: { estado: "cancelled", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, type, deleted: owner };
  }

  if (type === "pay_done" || type === "pay_pending" || type === "pay_failed") {
    const id = safeText(request.data?.id, 120);
    if (!id) throw new HttpsError("invalid-argument", "ID requerido.");
    await db.collection("notificaciones_master").doc(id).delete();
    return { ok: true, type, deleted: id };
  }

  throw new HttpsError("invalid-argument", "Tipo no soportado.");
});

exports.upsertOwnerData = onCall(async (request) => {
  const c = await resolveSession(request, true);
  const owner = norm(c.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  await assertOwnerActive(owner);

  if (c.collaborator === true) {
    const username = norm(c.username);
    const id = `${owner}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(id).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || colData.activo === false) {
      throw new HttpsError("permission-denied", INACTIVE_MSG);
    }
  }

  const payload = request.data?.db;
  if (!payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "DB invÃ¡lida.");
  await db.collection("datos_del_propietario").doc(owner).set({
    owner,
    db: payload,
    "base de datos": payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtClient: Number(request.data?.updatedAtClient || Date.now()),
    syncKey: String(request.data?.syncKey || `${Date.now()}`),
    updatedBy: norm(c.username || owner),
    updatedFrom: "server-callable"
  }, { merge: true });
  return { ok: true, owner };
});

exports.getOwnerData = onCall(async (request) => {
  const c = await resolveSession(request, true);
  const owner = norm(c.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  await assertOwnerActive(owner);

  if (c.collaborator === true) {
    const username = norm(c.username);
    const id = `${owner}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(id).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || colData.activo === false) {
      throw new HttpsError("permission-denied", INACTIVE_MSG);
    }
  }

  const snap = await db.collection("datos_del_propietario").doc(owner).get();
  if (!snap.exists) return { ok: false, owner, db: null };
  const data = snap.data() || {};
  return { ok: true, owner, db: data.db || data["base de datos"] || null, raw: data };
});



