(function () {
  const BASE = "https://us-central1-luro-control.cloudfunctions.net";
  const statusEl = () => document.getElementById("status");
  const loginButtonEl = () => document.getElementById("login-submit");
  const payBox = () => document.getElementById("pay-box");
  const payLink = () => document.getElementById("pay-link");
  const payPalSlot = () => document.getElementById("paypal-register-slot");
  let paypalSdkReady = false;

  function setStatus(message = "", kind = "") {
    const el = statusEl();
    if (!el) return;
    el.textContent = String(message || "");
    el.classList.remove("is-error", "is-success");
    if (kind === "error") el.classList.add("is-error");
    if (kind === "success") el.classList.add("is-success");
  }

  function sanitizeErrorMessage(message) {
    const raw = String(message || "").trim();
    if (!raw) return "No se pudo completar la solicitud en este momento.";
    if (/<!doctype html|<html|<head|<body/i.test(raw)) {
      return "No se pudo validar el acceso en este momento. Intenta nuevamente en unos segundos.";
    }
    return raw.replace(/\s+/g, " ").trim();
  }

  function setLoginBusy(busy) {
    const btn = loginButtonEl();
    if (!btn) return;
    if (!btn.dataset.baseText) btn.dataset.baseText = btn.textContent.trim();
    btn.disabled = !!busy;
    btn.textContent = busy ? "Validando acceso..." : btn.dataset.baseText;
  }

  function hidePayPalSlot() {
    const slot = payPalSlot();
    if (!slot) return;
    slot.classList.add("hidden");
    slot.innerHTML = "";
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
    setStatus("");
    payBox()?.classList.add("hidden");
    hidePayPalSlot();
  };

  function applyPlanFromQuery() {
    const qp = new URLSearchParams(window.location.search || "");
    const plan = String(qp.get("plan") || "").trim().toLowerCase();
    if (!plan) return;
    const sel = document.getElementById("reg-plan");
    if (!sel) return;
    const allowed = ["basico", "profesional", "empresarial"];
    if (allowed.includes(plan)) sel.value = plan;
  }

  async function call(name, data) {
    const r = await fetch(`${BASE}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    const contentType = String(r.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      const rawText = await r.text().catch(() => "");
      throw new Error(sanitizeErrorMessage(rawText || `HTTP ${r.status}`));
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      throw new Error(sanitizeErrorMessage(j?.error?.message || j?.message || `HTTP ${r.status}`));
    }
    return j.result || {};
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
    } catch (_e) {
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
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || "USD")}&intent=subscription&vault=true`;
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
    if (!slot) return false;
    slot.innerHTML = "";

    const cfg = await call("getPublicBillingConfig", {});
    const clientId = String(cfg?.paypalClientId || "").trim();
    const currency = String(cfg?.currency || "USD").trim();
    const planIds = cfg?.planIds && typeof cfg.planIds === "object" ? cfg.planIds : {};
    const planId = String(planIds[String(payload?.plan || "").toLowerCase()] || payload?.paypalPlanId || "").trim();
    if (!clientId || !planId) return false;

    await loadPayPalSdk(clientId, currency);
    if (!window.paypal || !window.paypal.Buttons) return false;

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
        if (!subscriptionID) throw new Error("PayPal no devolvió subscriptionID.");
        await call("confirmPaypalSubscriptionApproval", {
          owner,
          negocioId,
          plan,
          password: ownerPassword,
          subscriptionId: subscriptionID
        });
        setStatus("Suscripción autorizada. Activando acceso...", "success");
        setTimeout(() => {
          window.location.href = "app.html";
        }, 900);
      },
      onError: function () {
        setStatus("No se pudo completar la autorización de PayPal. Intenta nuevamente.", "error");
      }
    }).render(slot);
    return true;
  }

  window.loginSaas = async function (ev) {
    ev.preventDefault();
    const user = document.getElementById("login-user").value.trim().toLowerCase();
    const pass = document.getElementById("login-pass").value.replace(/\u00a0/g, " ").trim();
    if (!user || !pass) {
      setStatus("Completa usuario y contraseña para continuar.", "error");
      return false;
    }
    setStatus("Validando acceso...");
    setLoginBusy(true);
    payBox()?.classList.add("hidden");
    hidePayPalSlot();
    try {
      const rs = await call("authenticateSession", { username: user, password: pass });
      if (!rs?.ok) throw new Error("Credenciales inválidas.");
      sessionStorage.setItem("LURO_SAAS_PENDING_LOGIN", JSON.stringify({ user, pass, at: Date.now() }));
      setStatus("Acceso correcto. Redirigiendo...", "success");
      window.location.href = "app.html";
    } catch (e) {
      const rawMessage = sanitizeErrorMessage(e.message || e || "");
      const normalizedMessage = rawMessage.trim().toLowerCase();
      if (normalizedMessage === "internal") {
        setStatus("No se pudo validar el acceso. Usa el correo del negocio o el usuario exacto del colaborador.", "error");
      } else if (/credenciales|inválid|invalid|incorrect/i.test(rawMessage)) {
        setStatus("Usuario o contraseña incorrectos. Verifica los datos e intenta nuevamente.", "error");
      } else {
        setStatus(`No se pudo iniciar sesión. ${rawMessage}`, "error");
      }
    } finally {
      setLoginBusy(false);
    }
    return false;
  };

  window.registerBusiness = async function (ev) {
    ev.preventDefault();
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
    setStatus("Creando cuenta...");
    payBox()?.classList.add("hidden");
    hidePayPalSlot();
    try {
      const rs = await call("registerBusiness", payload);
      const user = String(rs?.username || payload.email).toLowerCase();
      const pass = payload.password;
      sessionStorage.setItem("LURO_SAAS_PENDING_LOGIN", JSON.stringify({ user, pass, at: Date.now() }));

      payBox()?.classList.remove("hidden");
      payLink()?.classList.add("hidden");
      const planNombre = String(rs?.planInfo?.nombre || "Suscripción");
      const monto = Number(rs?.planInfo?.montoUSD || 0).toFixed(2);
      setStatus(`Cuenta creada en estado pendiente. Autoriza la suscripción ${planNombre} (USD$${monto}) para activar tu acceso.`, "success");

      const rendered = await renderRegisterPayPalButton({
        owner: String(rs?.owner || user).toLowerCase(),
        negocioId: String(rs?.negocioId || ""),
        plan: String(rs?.plan || payload.plan || "basico"),
        paypalPlanId: String(rs?.paypalPlanId || "")
      });
      if (!rendered) {
        setStatus("Cuenta creada en estado pendiente. Falta configurar PayPal Subscriptions en backend.", "error");
      }
    } catch (e) {
      setStatus(`No se pudo completar el registro. ${String(e.message || e)}`, "error");
    }
    return false;
  };

  document.getElementById("login-user")?.addEventListener("input", () => setStatus(""));
  document.getElementById("login-pass")?.addEventListener("input", () => setStatus(""));
  applyPlanFromQuery();
})();
