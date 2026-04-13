const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const crypto = require("crypto");

const WHATSAPP_EVENT_LOCKS = "whatsapp_event_locks";
const WHATSAPP_DELIVERY_LOGS = "whatsapp_delivery_logs";

function parseBool(raw, fallback = false) {
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim().toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "si", "on", "enabled", "activo"].includes(text)) return true;
  if (["0", "false", "no", "off", "disabled", "inactivo"].includes(text)) return false;
  return fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function truncateText(value, max = 300) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatMoney(amount) {
  const value = toNumber(amount);
  return value.toFixed(2);
}

function formatQty(value) {
  const n = toNumber(value);
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
}

function normalizePhone(rawPhone, defaultCountryCode = "1") {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 10) {
    digits = `${String(defaultCountryCode || "1").replace(/\D/g, "")}${digits}`;
  }

  if (digits.startsWith("0") && digits.length > 10) {
    const noLeadingZero = digits.replace(/^0+/, "");
    if (noLeadingZero.length >= 10 && noLeadingZero.length <= 15) {
      digits = noLeadingZero;
    }
  }

  if (digits.length < 10 || digits.length > 15) return "";
  return digits;
}

function defaultEventMessage(eventType, payload = {}) {
  const owner = String(payload.owner || "").toUpperCase();
  const modulo = String(payload.modulo || "").trim();
  const moduloTxt = modulo ? ` Modulo: ${modulo}.` : "";

  if (eventType === "abastecimiento_registrado") {
    const nombre = String(payload.producto || payload.nombre || "PRODUCTO").trim();
    const cantidad = formatQty(payload.cantidad);
    const unidad = String(payload.unidad || payload.medida || "unid").trim();
    return `LuRo Notificacion: El producto ${nombre} ha sido abastecido con ${cantidad} ${unidad}. Estado actualizado correctamente.${moduloTxt}`;
  }

  if (eventType === "faltante_detectado") {
    const nombre = String(payload.producto || payload.nombre || "PRODUCTO").trim();
    const faltante = formatQty(payload.faltante);
    const unidad = String(payload.unidad || "unid").trim();
    return `LuRo Alerta: El producto ${nombre} presenta faltante. Cantidad faltante: ${faltante} ${unidad}. Se recomienda abastecimiento.${moduloTxt}`;
  }

  if (eventType === "faltante_en_abastecimiento") {
    const nombre = String(payload.producto || payload.nombre || "PRODUCTO").trim();
    const pendiente = formatQty(payload.faltanteActual);
    const unidad = String(payload.unidad || "unid").trim();
    return `LuRo Notificacion: El faltante de ${nombre} se esta abasteciendo. Pendiente actual: ${pendiente} ${unidad}.${moduloTxt}`;
  }

  if (eventType === "faltante_abastecido") {
    const nombre = String(payload.producto || payload.nombre || "PRODUCTO").trim();
    return `LuRo Notificacion: El faltante de ${nombre} fue abastecido completamente. Estado actualizado correctamente.${moduloTxt}`;
  }

  if (eventType === "gasto_registrado") {
    const monto = formatMoney(payload.monto || payload.perdidaTotal || 0);
    const categoria = String(payload.categoria || payload.tipo || "operativo").trim();
    return `LuRo Gasto Registrado: Se registro un gasto de RD$${monto} en ${categoria}.${moduloTxt}`;
  }

  if (eventType === "venta_registrada") {
    const monto = formatMoney(payload.monto || payload.totalVenta || 0);
    const cantidad = Number(payload.cantidadVentas || payload.cantidad || 1);
    if (cantidad > 1) {
      return `LuRo Venta Registrada: Se registraron ${cantidad} ventas por RD$${monto}.${moduloTxt}`;
    }
    return `LuRo Venta Registrada: Se registro una venta por RD$${monto}.${moduloTxt}`;
  }

  if (eventType === "produccion_creada") {
    const nombre = String(payload.producto || payload.nombre || "PRODUCCION").trim();
    const cantidad = String(payload.cantidad || "").trim();
    return `LuRo Produccion Creada: Se creo una nueva produccion de ${nombre}${cantidad ? ` con cantidad ${cantidad}` : ""}.${moduloTxt}`;
  }

  const title = truncateText(payload.title || payload.type || payload.eventType || "Notificacion general", 120);
  const message = truncateText(payload.message || payload.descripcion || "", 240);
  return `LuRo Notificacion General: ${title}.${message ? ` ${message}` : ""}${owner ? ` Owner: ${owner}.` : ""}${moduloTxt}`;
}

function entrySignature(item = {}) {
  return [
    String(item.producto || item.nombre || "").trim().toLowerCase(),
    toNumber(item.cantidad || item.cant || 0).toFixed(4),
    String(item.unidad || item.medida || "").trim().toLowerCase(),
    String(item.fecha || "").trim(),
    String(item.tipo || "").trim().toLowerCase(),
    String(item.operador || "").trim().toLowerCase(),
    String(item.modulo || "").trim().toLowerCase()
  ].join("|");
}

function saleSignature(item = {}) {
  return [
    String(item.plato || item.producto || "").trim().toLowerCase(),
    toNumber(item.cantidad || 0).toFixed(4),
    toNumber(item.totalVenta || item.total || 0).toFixed(2),
    String(item.fecha || "").trim(),
    String(item.mesa || "").trim().toLowerCase(),
    String(item.modulo || "").trim().toLowerCase(),
    String(item.ts || "").trim()
  ].join("|");
}

function productionSignature(item = {}) {
  return [
    String(item.producto || item.nombre || "").trim().toLowerCase(),
    String(item.cantidad || "").trim(),
    toNumber(item.costoOp || item.costo || 0).toFixed(2),
    String(item.fecha || "").trim(),
    String(item.modulo || "").trim().toLowerCase(),
    String(item.operador || "").trim().toLowerCase()
  ].join("|");
}

function expenseSignature(item = {}) {
  return [
    String(item.tipo || "").trim().toLowerCase(),
    String(item.nombre || item.producto || "").trim().toLowerCase(),
    toNumber(item.cant || item.cantidad || 0).toFixed(4),
    toNumber(item.perdida || item.monto || 0).toFixed(2),
    String(item.fecha || "").trim(),
    String(item.modulo || "").trim().toLowerCase()
  ].join("|");
}

function collectAddedRecords(beforeArr, afterArr, signatureFn, maxItems = 6) {
  const beforeSet = new Set(asArray(beforeArr).map((item) => signatureFn(item)).filter(Boolean));
  const afterList = asArray(afterArr);
  const added = [];

  for (let i = afterList.length - 1; i >= 0; i -= 1) {
    if (added.length >= maxItems) break;
    const row = afterList[i] || {};
    const sig = signatureFn(row);
    if (!sig || beforeSet.has(sig)) continue;
    added.unshift(row);
  }

  return added;
}

function getOperationalCount(dbRef = {}) {
  const keys = ["entradas", "ventas", "historial_prod", "decomisos", "almacen"];
  return keys.reduce((acc, key) => acc + asArray(dbRef[key]).length, 0);
}

function buildAlmacenMap(dbRef = {}, ownerKey = "", normFn = (v) => String(v || "").toLowerCase()) {
  const map = new Map();
  asArray(dbRef.almacen).forEach((item) => {
    const itemOwner = normFn(item?.owner || ownerKey);
    if (ownerKey && itemOwner && itemOwner !== ownerKey) return;
    const nombre = String(item?.nombre || item?.producto || "").trim();
    if (!nombre) return;
    const modulo = String(item?.modulo || "").trim();
    const key = `${String(modulo || "").toLowerCase()}::${normFn(nombre)}`;
    map.set(key, {
      nombre,
      modulo,
      unidad: String(item?.unidad || "unid").trim(),
      actual: toNumber(item?.actual),
      ideal: toNumber(item?.ideal)
    });
  });
  return map;
}

function buildOwnerDbEvents(beforeDb = {}, afterDb = {}, meta = {}) {
  const owner = String(meta.owner || "").trim().toLowerCase();
  const updatedAtClient = Number(meta.updatedAtClient || Date.now());
  const events = [];

  const newEntradas = collectAddedRecords(beforeDb.entradas, afterDb.entradas, entrySignature, 8);
  newEntradas.forEach((row) => {
    events.push({
      type: "abastecimiento_registrado",
      owner,
      eventKey: `entrada|${owner}|${entrySignature(row)}|${updatedAtClient}`,
      payload: {
        owner,
        producto: String(row?.producto || row?.nombre || "").trim(),
        cantidad: toNumber(row?.cantidad || row?.cant),
        unidad: String(row?.unidad || row?.medida || "").trim(),
        modulo: String(row?.modulo || "").trim(),
        operador: String(row?.operador || "").trim()
      }
    });
  });

  const newSales = collectAddedRecords(beforeDb.ventas, afterDb.ventas, saleSignature, 20);
  if (newSales.length > 0) {
    const totalVentas = newSales.reduce((acc, row) => acc + toNumber(row?.totalVenta || row?.total), 0);
    const modulo = String(newSales[newSales.length - 1]?.modulo || "").trim();
    events.push({
      type: "venta_registrada",
      owner,
      eventKey: `venta|${owner}|${newSales.length}|${totalVentas.toFixed(2)}|${updatedAtClient}`,
      payload: {
        owner,
        cantidadVentas: newSales.length,
        monto: totalVentas,
        modulo
      }
    });
  }

  const newProductions = collectAddedRecords(beforeDb.historial_prod, afterDb.historial_prod, productionSignature, 6);
  newProductions.forEach((row) => {
    events.push({
      type: "produccion_creada",
      owner,
      eventKey: `produccion|${owner}|${productionSignature(row)}|${updatedAtClient}`,
      payload: {
        owner,
        producto: String(row?.producto || row?.nombre || "").trim(),
        cantidad: String(row?.cantidad || "").trim(),
        costoOp: toNumber(row?.costoOp || row?.costo),
        modulo: String(row?.modulo || "").trim()
      }
    });
  });

  const newExpenses = collectAddedRecords(beforeDb.decomisos, afterDb.decomisos, expenseSignature, 20);
  if (newExpenses.length > 0) {
    const totalGasto = newExpenses.reduce((acc, row) => acc + toNumber(row?.perdida || row?.monto), 0);
    const categorias = Array.from(new Set(newExpenses.map((row) => String(row?.tipo || "operativo").trim()).filter(Boolean)));
    const modulo = String(newExpenses[newExpenses.length - 1]?.modulo || "").trim();
    events.push({
      type: "gasto_registrado",
      owner,
      eventKey: `gasto|${owner}|${newExpenses.length}|${totalGasto.toFixed(2)}|${updatedAtClient}`,
      payload: {
        owner,
        monto: totalGasto,
        categoria: categorias.join(", ") || "operativo",
        modulo,
        cantidad: newExpenses.length
      }
    });
  }

  const beforeMap = buildAlmacenMap(beforeDb, owner, (v) => String(v || "").trim().toLowerCase());
  const afterMap = buildAlmacenMap(afterDb, owner, (v) => String(v || "").trim().toLowerCase());

  let shortageDetected = 0;
  let shortageProgress = 0;
  let shortageResolved = 0;

  afterMap.forEach((afterItem, key) => {
    const beforeItem = beforeMap.get(key) || {
      nombre: afterItem.nombre,
      modulo: afterItem.modulo,
      unidad: afterItem.unidad,
      actual: 0,
      ideal: afterItem.ideal
    };

    const beforeMissing = Math.max(0, toNumber(beforeItem.ideal) - toNumber(beforeItem.actual));
    const afterMissing = Math.max(0, toNumber(afterItem.ideal) - toNumber(afterItem.actual));

    if (beforeMissing <= 0.0001 && afterMissing > 0.0001) {
      if (shortageDetected < 5) {
        shortageDetected += 1;
        events.push({
          type: "faltante_detectado",
          owner,
          eventKey: `faltante-on|${owner}|${key}|${afterMissing.toFixed(3)}|${updatedAtClient}`,
          payload: {
            owner,
            producto: afterItem.nombre,
            modulo: afterItem.modulo,
            unidad: afterItem.unidad,
            faltante: afterMissing,
            ideal: afterItem.ideal,
            actual: afterItem.actual
          }
        });
      }
      return;
    }

    if (beforeMissing > 0.0001 && afterMissing <= 0.0001) {
      if (shortageResolved < 5) {
        shortageResolved += 1;
        events.push({
          type: "faltante_abastecido",
          owner,
          eventKey: `faltante-off|${owner}|${key}|${updatedAtClient}`,
          payload: {
            owner,
            producto: afterItem.nombre,
            modulo: afterItem.modulo,
            unidad: afterItem.unidad
          }
        });
      }
      return;
    }

    if (beforeMissing > afterMissing && afterMissing > 0.0001) {
      const reduced = beforeMissing - afterMissing;
      const ratio = beforeMissing > 0 ? (reduced / beforeMissing) : 0;
      if ((reduced >= 1 || ratio >= 0.2) && shortageProgress < 5) {
        shortageProgress += 1;
        events.push({
          type: "faltante_en_abastecimiento",
          owner,
          eventKey: `faltante-progress|${owner}|${key}|${afterMissing.toFixed(3)}|${updatedAtClient}`,
          payload: {
            owner,
            producto: afterItem.nombre,
            modulo: afterItem.modulo,
            unidad: afterItem.unidad,
            faltantePrevio: beforeMissing,
            faltanteActual: afterMissing
          }
        });
      }
    }
  });

  return events;
}

function isLikelyBootstrapSync(beforeDb = {}, afterDb = {}) {
  const beforeCount = getOperationalCount(beforeDb);
  const afterCount = getOperationalCount(afterDb);
  return beforeCount === 0 && afterCount >= 10;
}

function buildGeneralEventFromMasterNotification(data = {}, notificationId = "") {
  const owner = String(data?.owner || "").trim().toLowerCase();
  const eventType = String(data?.type || "generic").trim().toLowerCase();
  const amount = toNumber(data?.amountUSD || 0);
  const plan = String(data?.plan || "").trim();
  const paymentStatus = String(data?.paymentStatus || "").trim();

  const msg = `LuRo Notificacion General: ${eventType || "evento"}${plan ? ` | Plan: ${plan}` : ""}${paymentStatus ? ` | Estado: ${paymentStatus}` : ""}${amount > 0 ? ` | Monto USD: ${amount.toFixed(2)}` : ""}.`;

  return {
    type: "notificacion_general",
    owner,
    eventKey: `master-notification|${owner}|${notificationId || Date.now()}`,
    payload: {
      owner,
      title: String(data?.type || "Notificacion") || "Notificacion",
      message: msg,
      eventType
    }
  };
}

function buildConfig(getCloudRuntimeConfig) {
  const runtime = (typeof getCloudRuntimeConfig === "function") ? (getCloudRuntimeConfig() || {}) : {};
  const waRuntime = runtime?.whatsapp && typeof runtime.whatsapp === "object" ? runtime.whatsapp : {};

  const provider = String(process.env.WHATSAPP_PROVIDER || waRuntime.provider || "meta_cloud").trim().toLowerCase();
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || waRuntime.access_token || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || waRuntime.phone_number_id || "").trim();
  const apiVersion = String(process.env.WHATSAPP_API_VERSION || waRuntime.api_version || "v20.0").trim();
  const enabledFlag = parseBool(process.env.WHATSAPP_ENABLED ?? waRuntime.enabled, true);
  const defaultCountryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || waRuntime.default_country_code || "1").replace(/\D/g, "") || "1";
  const useTemplate = parseBool(process.env.WHATSAPP_USE_TEMPLATE ?? waRuntime.use_template, false);
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || waRuntime.template_name || "").trim();
  const templateLanguage = String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || waRuntime.template_language || "es").trim();

  const missing = [];
  if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (provider !== "meta_cloud") missing.push("WHATSAPP_PROVIDER(meta_cloud)");

  const enabled = enabledFlag && missing.length === 0;
  return {
    provider,
    accessToken,
    phoneNumberId,
    apiVersion,
    enabled,
    enabledFlag,
    defaultCountryCode,
    useTemplate,
    templateName,
    templateLanguage,
    missing
  };
}

async function sendMetaMessage(config, to, message) {
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const payload = config.useTemplate && config.templateName
    ? {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: config.templateName,
        language: { code: config.templateLanguage },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: truncateText(message, 900) }
            ]
          }
        ]
      }
    }
    : {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: truncateText(message, 1400), preview_url: false }
    };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const raw = await response.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (_e) {
      body = { raw };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: truncateText(body?.error?.message || body?.message || `HTTP ${response.status}`, 280),
        body
      };
    }

    return {
      ok: true,
      status: response.status,
      messageId: String(body?.messages?.[0]?.id || "").trim(),
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: truncateText(error?.message || "No se pudo enviar mensaje WhatsApp", 280)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function canReceiveWhatsApp(ownerData = {}) {
  if (!ownerData || typeof ownerData !== "object") return false;
  if (ownerData.activo === false) return false;
  if (ownerData.whatsappEnabled === false) return false;
  if (ownerData?.notifications?.whatsapp === false) return false;
  if (ownerData?.whatsapp?.enabled === false) return false;
  return true;
}

function extractOwnerPhone(ownerData = {}) {
  return String(
    ownerData?.whatsapp?.phone ||
    ownerData?.phone ||
    ownerData?.telefono ||
    ownerData?.clienteRegistro?.telefono ||
    ""
  ).trim();
}

async function collectMasterRecipients({ db, config, norm, safeText, canAccessByStatus, FORCED_REMOVED_USER, MASTER_USER }) {
  const snap = await db.collection("owners").get();
  const uniquePhones = new Set();
  const recipients = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const username = norm(data.username || doc.id);
    if (!username || username === FORCED_REMOVED_USER) return;
    if (!canReceiveWhatsApp(data)) return;

    const activeByBusinessRule = typeof canAccessByStatus === "function"
      ? (canAccessByStatus(data) || norm(data.estado) === "activo" || username === MASTER_USER)
      : true;
    if (!activeByBusinessRule) return;

    const normalizedPhone = normalizePhone(extractOwnerPhone(data), config.defaultCountryCode);
    if (!normalizedPhone || uniquePhones.has(normalizedPhone)) return;

    uniquePhones.add(normalizedPhone);
    recipients.push({
      username,
      phone: normalizedPhone,
      label: safeText(data.adminName || data.firstName || username, 120)
    });
  });

  return recipients;
}

function eventLockId(eventKey = "") {
  return crypto.createHash("sha1").update(String(eventKey || "")).digest("hex");
}

async function acquireLock(db, admin, event) {
  const id = eventLockId(event.eventKey || `${event.type}-${Date.now()}`);
  const ref = db.collection(WHATSAPP_EVENT_LOCKS).doc(id);
  let acquired = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      acquired = false;
      return;
    }
    acquired = true;
    tx.set(ref, {
      eventType: String(event.type || "generic"),
      owner: String(event.owner || "").trim().toLowerCase(),
      eventKey: String(event.eventKey || ""),
      status: "processing",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { id, acquired };
}

async function finalizeLock(db, admin, lockId, status = "done", extra = {}) {
  if (!lockId) return;
  await db.collection(WHATSAPP_EVENT_LOCKS).doc(lockId).set({
    status: String(status || "done"),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra
  }, { merge: true });
}

async function logDelivery(db, admin, payload = {}) {
  await db.collection(WHATSAPP_DELIVERY_LOGS).add({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...payload
  });
}

async function dispatchWhatsAppEvent({
  event,
  db,
  admin,
  norm,
  safeText,
  canAccessByStatus,
  FORCED_REMOVED_USER,
  MASTER_USER,
  getCloudRuntimeConfig
}) {
  const config = buildConfig(getCloudRuntimeConfig);
  const owner = String(event?.owner || "").trim().toLowerCase();
  const eventType = String(event?.type || "notificacion_general").trim().toLowerCase();
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const message = defaultEventMessage(eventType, payload);

  if (!config.enabled) {
    await logDelivery(db, admin, {
      eventType,
      owner,
      eventKey: String(event?.eventKey || ""),
      status: "skipped-not-configured",
      reason: `WhatsApp no configurado. Faltan: ${config.missing.join(", ") || "configuracion"}`,
      config: {
        provider: config.provider,
        enabledFlag: config.enabledFlag,
        missing: config.missing
      }
    });
    return { ok: false, skipped: true, reason: "not-configured" };
  }

  const lock = await acquireLock(db, admin, event);
  if (!lock.acquired) {
    return { ok: true, skipped: true, reason: "duplicate", eventType };
  }

  try {
    const recipients = await collectMasterRecipients({
      db,
      config,
      norm,
      safeText,
      canAccessByStatus,
      FORCED_REMOVED_USER,
      MASTER_USER
    });

    if (!recipients.length) {
      await logDelivery(db, admin, {
        eventType,
        owner,
        eventKey: String(event?.eventKey || ""),
        status: "skipped-no-recipients",
        message,
        recipients: []
      });
      await finalizeLock(db, admin, lock.id, "skipped", { reason: "no-recipients" });
      return { ok: false, skipped: true, reason: "no-recipients" };
    }

    const deliveries = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendMetaMessage(config, recipient.phone, message);
      if (result.ok) sent += 1;
      else failed += 1;
      deliveries.push({
        owner: recipient.username,
        phone: recipient.phone,
        ok: result.ok,
        status: result.status,
        messageId: String(result.messageId || ""),
        error: truncateText(result.error || "", 280)
      });
    }

    const status = failed === 0 ? "sent" : (sent > 0 ? "partial" : "failed");
    await logDelivery(db, admin, {
      eventType,
      owner,
      eventKey: String(event?.eventKey || ""),
      status,
      message,
      sent,
      failed,
      recipientsCount: recipients.length,
      deliveries,
      config: {
        provider: config.provider,
        useTemplate: config.useTemplate,
        templateName: truncateText(config.templateName, 120)
      }
    });

    await finalizeLock(db, admin, lock.id, status, {
      sent,
      failed,
      recipientsCount: recipients.length
    });

    return { ok: sent > 0, sent, failed, recipientsCount: recipients.length, status };
  } catch (error) {
    const messageError = truncateText(error?.message || error, 320);
    await logDelivery(db, admin, {
      eventType,
      owner,
      eventKey: String(event?.eventKey || ""),
      status: "error",
      message,
      error: messageError
    });
    await finalizeLock(db, admin, lock.id, "error", { error: messageError });
    return { ok: false, error: messageError };
  }
}

function registerWhatsAppNotifications({
  db,
  admin,
  norm,
  safeText,
  canAccessByStatus,
  MASTER_USER,
  FORCED_REMOVED_USER,
  getCloudRuntimeConfig,
  resolveSession,
  getOwnerDoc
}) {
  const notifyWhatsAppOnOwnerDataUpdate = onDocumentUpdated("datos_del_propietario/{ownerId}", async (event) => {
    try {
      const beforePayload = event?.data?.before?.data() || {};
      const afterPayload = event?.data?.after?.data() || {};
      if (!afterPayload || typeof afterPayload !== "object") return;

      const owner = norm(afterPayload.owner || event?.params?.ownerId);
      if (!owner) return;

      const updatedFrom = norm(afterPayload.updatedFrom || "");
      if (updatedFrom !== "server-callable") return;

      const beforeDb = (beforePayload.db && typeof beforePayload.db === "object")
        ? beforePayload.db
        : (beforePayload["base de datos"] || {});
      const afterDb = (afterPayload.db && typeof afterPayload.db === "object")
        ? afterPayload.db
        : (afterPayload["base de datos"] || {});

      if (!beforeDb || typeof beforeDb !== "object" || !afterDb || typeof afterDb !== "object") return;
      if (isLikelyBootstrapSync(beforeDb, afterDb)) return;

      const events = buildOwnerDbEvents(beforeDb, afterDb, {
        owner,
        updatedAtClient: Number(afterPayload.updatedAtClient || Date.now())
      });

      for (const evt of events) {
        // eslint-disable-next-line no-await-in-loop
        await dispatchWhatsAppEvent({
          event: evt,
          db,
          admin,
          norm,
          safeText,
          canAccessByStatus,
          FORCED_REMOVED_USER,
          MASTER_USER,
          getCloudRuntimeConfig
        });
      }
    } catch (error) {
      console.error("[whatsapp] notifyWhatsAppOnOwnerDataUpdate error:", truncateText(error?.message || error, 320));
    }
  });

  const notifyWhatsAppOnMasterNotificationCreate = onDocumentCreated("notificaciones_master/{notificationId}", async (event) => {
    try {
      const data = event?.data?.data() || {};
      const notificationId = String(event?.params?.notificationId || "").trim();
      if (!data || typeof data !== "object") return;

      const evt = buildGeneralEventFromMasterNotification(data, notificationId);
      await dispatchWhatsAppEvent({
        event: evt,
        db,
        admin,
        norm,
        safeText,
        canAccessByStatus,
        FORCED_REMOVED_USER,
        MASTER_USER,
        getCloudRuntimeConfig
      });
    } catch (error) {
      console.error("[whatsapp] notifyWhatsAppOnMasterNotificationCreate error:", truncateText(error?.message || error, 320));
    }
  });

  const setOwnerWhatsAppConfig = onCall(async (request) => {
    const session = await resolveSession(request, true);
    const callerOwner = norm(session.owner || session.username);
    const targetOwner = norm(request.data?.owner || callerOwner);
    if (!targetOwner) throw new HttpsError("invalid-argument", "Owner requerido.");

    const isSuper = session.superMaster === true;
    if (!isSuper && callerOwner !== targetOwner) {
      throw new HttpsError("permission-denied", "Sin permisos para actualizar este owner.");
    }

    const config = buildConfig(getCloudRuntimeConfig);
    const enabled = request.data?.enabled !== false;
    const rawPhone = safeText(request.data?.phone, 40);
    const normalizedPhone = normalizePhone(rawPhone, config.defaultCountryCode);

    if (enabled && !normalizedPhone) {
      throw new HttpsError("invalid-argument", "Numero de WhatsApp invalido. Use formato internacional.");
    }

    const ownerEntry = await getOwnerDoc(targetOwner);
    if (!ownerEntry) throw new HttpsError("not-found", "Owner no encontrado.");

    await db.collection("owners").doc(ownerEntry.id || targetOwner).set({
      whatsappEnabled: enabled === true,
      whatsapp: {
        enabled: enabled === true,
        phone: normalizedPhone || "",
        updatedBy: norm(session.username || callerOwner),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      phone: normalizedPhone || safeText(ownerEntry?.data?.phone || "", 30)
    }, { merge: true });

    return {
      ok: true,
      owner: targetOwner,
      enabled: enabled === true,
      phone: normalizedPhone || ""
    };
  });

  const sendWhatsAppTestNotification = onCall(async (request) => {
    const session = await resolveSession(request, true);
    if (session.superMaster !== true) {
      throw new HttpsError("permission-denied", "Solo super master puede enviar pruebas globales.");
    }

    const owner = norm(request.data?.owner || session.owner || MASTER_USER);
    const customMessage = truncateText(request.data?.message || "", 900);

    const evt = {
      type: "notificacion_general",
      owner,
      eventKey: `manual-test|${owner}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`,
      payload: {
        owner,
        title: "Prueba WhatsApp",
        message: customMessage || "LuRo Notificacion: prueba de envio de WhatsApp completada."
      }
    };

    const result = await dispatchWhatsAppEvent({
      event: evt,
      db,
      admin,
      norm,
      safeText,
      canAccessByStatus,
      FORCED_REMOVED_USER,
      MASTER_USER,
      getCloudRuntimeConfig
    });

    return {
      ok: true,
      owner,
      result
    };
  });

  return {
    notifyWhatsAppOnOwnerDataUpdate,
    notifyWhatsAppOnMasterNotificationCreate,
    setOwnerWhatsAppConfig,
    sendWhatsAppTestNotification
  };
}

module.exports = {
  registerWhatsAppNotifications,
  normalizePhone
};