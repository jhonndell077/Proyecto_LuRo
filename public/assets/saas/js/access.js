(function () {
  const BASE = "https://us-central1-luro-control.cloudfunctions.net";
  const PLAN_STORAGE_KEY = "LURO_SAAS_SELECTED_PLAN";
  const PLAN_KEYS = ["basico", "profesional", "empresarial"];
  const PLAN_STORAGE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

  const statusEl = () => document.getElementById("status");
  const payBox = () => document.getElementById("pay-box");
  const payBoxCopy = () => document.getElementById("pay-box-copy");
  const payBoxNote = () => document.getElementById("pay-box-note");
  const payLink = () => document.getElementById("pay-link");
  const payPalSlot = () => document.getElementById("paypal-register-slot");
  const loginForm = () => document.getElementById("form-login");
  const selectedPlanSummary = () => document.getElementById("selected-plan-summary");
  const selectedPlanLabel = () => document.getElementById("selected-plan-label");
  const selectedPlanTitle = () => document.getElementById("selected-plan-title");
  const selectedPlanPrice = () => document.getElementById("selected-plan-price");
  const selectedPlanDescription = () => document.getElementById("selected-plan-description");

  let paypalSdkReady = false;
  let publicBillingConfigCache = null;
  let selectedPlanMeta = null;

  function formatUsd(amount) {
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) return "USD$0.00 / mes";
    return `USD$${value.toFixed(2)} / mes`;
  }

  function normalizePlanMeta(raw = {}, fallbackPlan = "") {
    const id = String(raw?.id || raw?.plan || fallbackPlan || "").trim().toLowerCase();
    if (!PLAN_KEYS.includes(id)) return null;
    const amount = Number(raw?.montoUSD ?? raw?.amountUSD ?? raw?.priceUSD ?? raw?.price ?? 0);
    return {
      id,
      nombre: String(raw?.nombre || raw?.name || raw?.title || "").trim(),
      descripcion: String(raw?.descripcion || raw?.description || "").trim(),
      montoUSD: Number.isFinite(amount) ? amount : 0
    };
  }

  function mergePlanMeta(...candidates) {
    let merged = null;
    candidates.forEach((candidate) => {
      const normalized = normalizePlanMeta(candidate || {}, merged?.id || "");
      if (!normalized) return;
      merged = {
        ...(merged || {}),
        ...normalized
      };
    });
    return normalizePlanMeta(merged || {});
  }

  function getPublicPlans() {
    return publicBillingConfigCache?.plans && typeof publicBillingConfigCache.plans === "object"
      ? publicBillingConfigCache.plans
      : {};
  }

  function persistSelectedPlan(meta) {
    const normalized = normalizePlanMeta(meta || {});
    if (!normalized) return null;
    selectedPlanMeta = normalized;
    try {
      sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...normalized, at: Date.now(), source: "access" }));
    } catch (_error) {
      // Ignore storage issues and continue.
    }
    return normalized;
  }

  function readStoredPlan() {
    try {
      const raw = sessionStorage.getItem(PLAN_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const at = Number(parsed?.at || 0);
      if (at && Date.now() - at > PLAN_STORAGE_MAX_AGE_MS) {
        sessionStorage.removeItem(PLAN_STORAGE_KEY);
        return null;
      }
      return normalizePlanMeta(parsed || {});
    } catch (_error) {
      return null;
    }
  }

  function readQueryPlan() {
    const qp = new URLSearchParams(window.location.search || "");
    const plan = String(qp.get("plan") || "").trim().toLowerCase();
    if (!PLAN_KEYS.includes(plan)) return null;
    return normalizePlanMeta({
      id: plan,
      nombre: qp.get("plan_name"),
      montoUSD: qp.get("plan_price"),
      descripcion: qp.get("plan_desc")
    }, plan);
  }

  function resolveSelectedPlan(planId = "") {
    const selectedId = String(planId || document.getElementById("reg-plan")?.value || "").trim().toLowerCase();
    const fromPublicConfig = normalizePlanMeta(getPublicPlans()[selectedId] || {}, selectedId);
    const fromStorage = readStoredPlan();
    const fromQuery = readQueryPlan();
    const fallback = normalizePlanMeta({ id: selectedId }, selectedId);
    return mergePlanMeta(fromStorage, fromQuery, fromPublicConfig, fallback);
  }

  function renderSelectedPlanSummary(meta = null) {
    const box = selectedPlanSummary();
    if (!box) return;
    const registerVisible = !document.getElementById("form-register").classList.contains("hidden");
    const normalized = normalizePlanMeta(meta || {});
    if (!normalized || !registerVisible) {
      box.classList.add("hidden");
      return;
    }
    if (selectedPlanLabel()) selectedPlanLabel().textContent = "Plan seleccionado";
    if (selectedPlanTitle()) selectedPlanTitle().textContent = normalized.nombre || "Plan seleccionado";
    if (selectedPlanPrice()) selectedPlanPrice().textContent = formatUsd(normalized.montoUSD);
    if (selectedPlanDescription()) selectedPlanDescription().textContent = normalized.descripcion || "";
    box.classList.remove("hidden");
  }

  function syncPlanSelectOptions() {
    const sel = document.getElementById("reg-plan");
    if (!sel) return;
    const plans = getPublicPlans();
    Array.from(sel.options).forEach((option) => {
      const meta = normalizePlanMeta(plans[option.value] || {}, option.value);
      if (!meta) return;
      option.textContent = `${meta.nombre} - ${formatUsd(meta.montoUSD)}`;
    });
  }

  async function hydratePlanSelection() {
    try {
      publicBillingConfigCache = await getPublicBillingConfig();
    } catch (_error) {
      publicBillingConfigCache = publicBillingConfigCache || null;
    }
    syncPlanSelectOptions();
    const resolved = resolveSelectedPlan();
    if (resolved) persistSelectedPlan(resolved);
    renderSelectedPlanSummary(resolved || selectedPlanMeta);
  }

  function setSaasLoading(visible, title = "Accediendo al sistema", message = "Validando tu negocio y preparando el acceso...") {
    const overlay = document.getElementById("saas-loading-overlay");
    const titleEl = document.getElementById("saas-loading-title");
    const messageEl = document.getElementById("saas-loading-message");
    const btn = loginForm()?.querySelector('button[type="submit"]');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (overlay) {
      overlay.style.display = visible ? "flex" : "none";
      overlay.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    if (btn) {
      if (!btn.dataset.baseText) btn.dataset.baseText = (btn.textContent || "Entrar al sistema").trim();
      btn.disabled = !!visible;
      btn.textContent = visible ? "Validando..." : btn.dataset.baseText;
    }
  }

  function hidePayPalSlot() {
    const slot = payPalSlot();
    if (!slot) return;
    slot.classList.add("hidden");
    slot.innerHTML = "";
  }

  function hidePayLink() {
    const link = payLink();
    if (!link) return;
    link.classList.add("hidden");
    link.removeAttribute("href");
  }

  function showPayLink(url, label = "Pagar ahora") {
    const link = payLink();
    if (!link) return;
    link.href = String(url || "").trim();
    link.textContent = label;
    link.classList.remove("hidden");
  }

  function setPayBoxState(options = {}) {
    const box = payBox();
    const copyEl = payBoxCopy();
    const noteEl = payBoxNote();
    const mode = String(options?.mode || "").trim();
    const copy = String(options?.copy || "").trim();
    const note = String(options?.note || "").trim();
    if (box) {
      if (mode) box.dataset.paymentMode = mode;
      else box.removeAttribute("data-payment-mode");
    }
    if (copyEl) {
      if (!copyEl.dataset.defaultHtml) copyEl.dataset.defaultHtml = copyEl.innerHTML;
      copyEl.innerHTML = copy || copyEl.dataset.defaultHtml;
    }
    if (noteEl) {
      noteEl.textContent = note;
      noteEl.classList.toggle("hidden", !note);
    }
  }

  function showPayPalSlot() {
    const slot = payPalSlot();
    if (!slot) return;
    slot.classList.remove("hidden");
  }

  window.showTab = function (tab) {
    const login = tab === "login";
    document.getElementById("form-login").classList.toggle("hidden", !login);
    document.getElementById("form-register").classList.toggle("hidden", login);
    document.getElementById("tab-login").classList.toggle("active", login);
    document.getElementById("tab-register").classList.toggle("active", !login);
    statusEl().textContent = "";
    payBox()?.classList.add("hidden");
    hidePayLink();
    hidePayPalSlot();
    setPayBoxState({});
    renderSelectedPlanSummary(selectedPlanMeta);
  };

  function applyPlanFromQuery() {
    const qp = new URLSearchParams(window.location.search || "");
    const plan = String(qp.get("plan") || "").trim().toLowerCase();
    const sel = document.getElementById("reg-plan");
    if (!sel) return;
    if (PLAN_KEYS.includes(plan)) sel.value = plan;
    const tab = String(qp.get("tab") || "").trim().toLowerCase();
    if (tab === "register" || PLAN_KEYS.includes(plan)) {
      window.showTab("register");
    }
  }

  async function call(name, data) {
    const r = await fetch(`${BASE}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      throw new Error(String(j?.error?.message || j?.message || `HTTP ${r.status}`));
    }
    return j.result || {};
  }

  async function getPublicBillingConfig() {
    if (publicBillingConfigCache) return publicBillingConfigCache;
    publicBillingConfigCache = await call("getPublicBillingConfig", {});
    return publicBillingConfigCache;
  }

  function readPendingAuth() {
    try {
      const raw = sessionStorage.getItem("LURO_SAAS_PENDING_LOGIN");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const user = String(parsed?.user || "").trim().toLowerCase();
      const pass = String(parsed?.pass || "");
      if (!user || !pass) return null;
      return { user, pass };
    } catch (_error) {
      return null;
    }
  }

  function loadPayPalSdk(clientId, currency) {
    return new Promise((resolve, reject) => {
      if (paypalSdkReady && window.paypal && window.paypal.Buttons) return resolve();
      const existing = document.querySelector("script[data-paypal-sdk-access='1']");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("No se pudo cargar PayPal SDK")), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || "USD")}&intent=subscription&vault=true&components=buttons`;
      s.async = true;
      s.dataset.paypalSdkAccess = "1";
      s.onload = () => {
        paypalSdkReady = true;
        resolve();
      };
      s.onerror = () => reject(new Error("No se pudo cargar PayPal SDK"));
      document.head.appendChild(s);
    });
  }

  async function renderRegisterPayPalButton(payload) {
    const slot = payPalSlot();
    if (!slot) return { rendered: false, cfg: null, reason: "slot_missing" };
    slot.innerHTML = "";

    const cfg = await getPublicBillingConfig();
    const clientId = String(cfg?.paypalClientId || "").trim();
    const currency = String(cfg?.currency || "USD").trim();
    const planIds = cfg?.planIds && typeof cfg.planIds === "object" ? cfg.planIds : {};
    const planId = String(planIds[String(payload?.plan || "").toLowerCase()] || payload?.paypalPlanId || "").trim();
    if (cfg?.subscriptionsReady !== true || !clientId || !planId) {
      return { rendered: false, cfg, reason: "subscriptions_not_ready" };
    }

    await loadPayPalSdk(clientId, currency);
    if (!window.paypal || !window.paypal.Buttons) {
      return { rendered: false, cfg, reason: "sdk_unavailable" };
    }

    const owner = String(payload?.owner || "").trim().toLowerCase();
    const negocioId = String(payload?.negocioId || "").trim();
    const plan = String(payload?.plan || "basico").trim().toLowerCase();
    const pending = readPendingAuth();
    const ownerPassword = pending && pending.user === owner ? pending.pass : "";

    showPayPalSlot();
    await window.paypal.Buttons({
      style: { shape: "pill", layout: "vertical", color: "gold", label: "subscribe", height: 42 },
      createSubscription: function (_data, actions) {
        return actions.subscription.create({
          plan_id: planId,
          custom_id: `${owner}|${negocioId}|${plan}`.slice(0, 127)
        });
      },
      onApprove: async function (data) {
        const subscriptionID = String(data?.subscriptionID || "").trim();
        if (!subscriptionID) throw new Error("PayPal no devolvio subscriptionID.");
        await call("confirmPaypalSubscriptionApproval", {
          owner,
          negocioId,
          plan,
          password: ownerPassword,
          subscriptionId: subscriptionID
        });
        statusEl().textContent = "Suscripcion autorizada. Activando acceso...";
        setTimeout(() => {
          window.location.href = "app.html";
        }, 900);
      },
      onError: function () {
        statusEl().textContent = "Error en PayPal Subscriptions. Intente nuevamente.";
      }
    }).render(slot);
    return { rendered: true, cfg, reason: "ok" };
  }

  window.loginSaas = async function (ev) {
    ev.preventDefault();
    const user = document.getElementById("login-user").value.trim().toLowerCase();
    const pass = document.getElementById("login-pass").value;
    statusEl().textContent = "Validando...";
    payBox()?.classList.add("hidden");
    hidePayLink();
    hidePayPalSlot();
    setPayBoxState({});
    setSaasLoading(true);
    try {
      const rs = await call("authenticateSession", { username: user, password: pass });
      if (!rs?.ok) throw new Error("Credenciales invalidas.");
      sessionStorage.setItem("LURO_SAAS_PENDING_LOGIN", JSON.stringify({ user, pass, at: Date.now() }));
      statusEl().textContent = "Acceso correcto. Redirigiendo...";
      window.location.href = "app.html";
    } catch (e) {
      statusEl().textContent = `Error: ${String(e.message || e)}`;
      setSaasLoading(false);
    }
    return false;
  };

  window.registerBusiness = async function (ev) {
    ev.preventDefault();
    const currentSelection = resolveSelectedPlan(document.getElementById("reg-plan")?.value);
    if (currentSelection) {
      persistSelectedPlan(currentSelection);
      renderSelectedPlanSummary(currentSelection);
    }

    const payload = {
      businessName: document.getElementById("reg-business").value.trim(),
      adminName: document.getElementById("reg-admin").value.trim(),
      firstName: document.getElementById("reg-firstname").value.trim(),
      lastName: document.getElementById("reg-lastname").value.trim(),
      cedula: document.getElementById("reg-cedula").value.trim(),
      email: document.getElementById("reg-email").value.trim().toLowerCase(),
      phone: document.getElementById("reg-phone").value.trim(),
      password: document.getElementById("reg-pass").value,
      plan: document.getElementById("reg-plan").value,
      billingDay: Number(document.getElementById("reg-billing-day")?.value || 0)
    };

    statusEl().textContent = "Creando cuenta...";
    payBox()?.classList.add("hidden");
    hidePayLink();
    hidePayPalSlot();
    setPayBoxState({});

    try {
      const rs = await call("registerBusiness", payload);
      const user = String(rs?.username || payload.email).toLowerCase();
      const pass = payload.password;
      sessionStorage.setItem("LURO_SAAS_PENDING_LOGIN", JSON.stringify({ user, pass, at: Date.now() }));

      payBox()?.classList.remove("hidden");
      hidePayLink();

      const resolvedPlan = mergePlanMeta(selectedPlanMeta, rs?.planInfo);
      if (resolvedPlan) {
        persistSelectedPlan(resolvedPlan);
        renderSelectedPlanSummary(resolvedPlan);
      }

      const planNombre = String(resolvedPlan?.nombre || "Suscripcion");
      const monto = Number(resolvedPlan?.montoUSD || 0).toFixed(2);
      const planDescripcion = String(resolvedPlan?.descripcion || "").trim();
      const paymentUrl = String(rs?.paymentUrl || "").trim();
      statusEl().textContent = `Cuenta creada en estado pendiente. Autoriza ${planNombre} (USD$${monto}) para activar tu acceso.`;

      const rendered = await renderRegisterPayPalButton({
        owner: String(rs?.owner || user).toLowerCase(),
        negocioId: String(rs?.negocioId || ""),
        plan: String(rs?.plan || payload.plan || "basico"),
        paypalPlanId: String(rs?.paypalPlanId || "")
      });

      if (rendered?.rendered) {
        setPayBoxState({
          mode: "subscription_sdk",
          copy: `<strong>${planNombre}:</strong> autoriza la suscripcion por USD$${monto} para activar tu acceso.`,
          note: planDescripcion
            ? `${planDescripcion} Tu cuenta ya fue creada; solo falta autorizar la suscripcion segura en PayPal.`
            : "Tu cuenta ya fue creada; solo falta autorizar la suscripcion segura en PayPal."
        });
        statusEl().textContent = `Cuenta creada. Autoriza ${planNombre} para activar tu acceso.`;
      } else if (paymentUrl) {
        showPayLink(paymentUrl, "Abrir pago PayPal");
        setPayBoxState({
          mode: String(rendered?.cfg?.paymentMode || rs?.paymentMode || "paypal_link"),
          copy: `<strong>${planNombre}:</strong> completa el cobro de USD$${monto} en PayPal.`,
          note: planDescripcion
            ? `${planDescripcion} La cuenta quedo creada en estado pendiente. Completa el pago en PayPal para continuar con la activacion.`
            : "La cuenta quedo creada en estado pendiente. Completa el pago en PayPal para continuar con la activacion."
        });
        statusEl().textContent = "Cuenta creada en estado pendiente. Completa el pago de PayPal para activar el acceso.";
      } else {
        setPayBoxState({
          mode: "unavailable",
          copy: `<strong>${planNombre}:</strong> el pago aun no puede procesarse desde este entorno.`,
          note: "PayPal no quedo listo para este plan. Revisa las credenciales, el client secret y los planes configurados."
        });
        statusEl().textContent = "Cuenta creada, pero PayPal no esta listo para activar el acceso automaticamente.";
      }
    } catch (e) {
      statusEl().textContent = `Error: ${String(e.message || e)}`;
    }
    return false;
  };

  applyPlanFromQuery();
  document.getElementById("reg-plan")?.addEventListener("change", () => {
    const resolved = resolveSelectedPlan(document.getElementById("reg-plan")?.value);
    if (resolved) persistSelectedPlan(resolved);
    renderSelectedPlanSummary(resolved || selectedPlanMeta);
  });
  hydratePlanSelection();
})();
