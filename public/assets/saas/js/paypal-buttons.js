(function () {
  const slots = Array.from(document.querySelectorAll(".paypal-button-slot"));
  if (!slots.length) return;

  const BASE = "https://us-central1-luro-control.cloudfunctions.net";
  const PLAN_STORAGE_KEY = "LURO_SAAS_SELECTED_PLAN";
  const PLAN_KEYS = ["basico", "profesional", "empresarial"];

  async function getBillingConfig() {
    try {
      const resp = await fetch(`${BASE}/getPublicBillingConfig`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.error) return null;
      return json?.result || null;
    } catch (_error) {
      return null;
    }
  }

  function formatUsd(amount) {
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) return "USD$0.00 / mes";
    return `USD$${value.toFixed(2)} / mes`;
  }

  function parseAmount(value) {
    const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
    return match ? Number(match[0]) : 0;
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

  function mergePlanMeta(baseMeta, overrideMeta) {
    const base = normalizePlanMeta(baseMeta || {});
    const override = normalizePlanMeta(overrideMeta || {}, base?.id || "");
    if (!base && !override) return null;
    return normalizePlanMeta({
      ...(base || {}),
      ...(override || {})
    }, override?.id || base?.id || "");
  }

  function getPublicPlans(config) {
    return config?.plans && typeof config.plans === "object" ? config.plans : {};
  }

  function resolveSlotMeta(config) {
    const mode = String(config?.paymentMode || "").trim().toLowerCase();
    if (mode === "subscription_sdk") {
      return {
        buttonText: "Crear cuenta y autorizar PayPal",
        note: "Suscripcion automatica lista."
      };
    }
    if (mode === "paypal_link") {
      return {
        buttonText: "Crear cuenta y abrir pago PayPal",
        note: "Pago por enlace PayPal."
      };
    }
    return {
      buttonText: "Crear cuenta",
      note: "PayPal aun no esta listo para este entorno."
    };
  }

  function readDomPlanMeta(slot) {
    const plan = String(slot.dataset.plan || "basico").trim().toLowerCase();
    const card = slot.closest(".card");
    const title = card?.querySelector(".plan-card-title, h3")?.textContent || "";
    const priceText = card?.querySelector(".plan-card-price")?.textContent || slot.dataset.amount || "";
    const description = card?.querySelector(".plan-card-description")?.textContent || "";
    return normalizePlanMeta({
      id: plan,
      nombre: title,
      descripcion: description,
      montoUSD: parseAmount(priceText) || parseAmount(slot.dataset.amount)
    }, plan);
  }

  function persistSelectedPlan(meta) {
    const normalized = normalizePlanMeta(meta || {});
    if (!normalized) return;
    try {
      sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...normalized, at: Date.now(), source: "landing" }));
    } catch (_error) {
      // Ignore storage issues and continue navigation.
    }
  }

  function buildFallbackHref(config, planMeta, currentHref) {
    const paypalMeUser = String(config?.paypalMeUser || "").trim().replace(/^@+/, "");
    if (!paypalMeUser) return currentHref || "";
    const amount = Number(planMeta?.montoUSD || 0).toFixed(2);
    return `https://paypal.me/${encodeURIComponent(paypalMeUser)}/${amount}`;
  }

  function syncPlanCard(card, slot, planMeta, config) {
    if (!card || !planMeta) return;
    const titleEl = card.querySelector(".plan-card-title, h3");
    const priceEl = card.querySelector(".plan-card-price");
    const descEl = card.querySelector(".plan-card-description");
    const fallback = card.querySelector(".paypal-fallback-link");

    if (titleEl && planMeta.nombre) titleEl.textContent = planMeta.nombre;
    if (priceEl) priceEl.textContent = formatUsd(planMeta.montoUSD);
    if (descEl && planMeta.descripcion) descEl.textContent = planMeta.descripcion;

    slot.dataset.amount = Number(planMeta.montoUSD || 0).toFixed(2);
    if (fallback) {
      fallback.href = buildFallbackHref(config, planMeta, fallback.href);
      fallback.textContent = `Pagar ${planMeta.nombre || "plan"}`;
      fallback.style.display = "none";
    }
  }

  function buildAccessHref(planMeta) {
    const params = new URLSearchParams();
    params.set("plan", String(planMeta?.id || "basico").trim().toLowerCase());
    params.set("tab", "register");
    return `acceder.html?${params.toString()}`;
  }

  getBillingConfig().then((config) => {
    const slotMeta = resolveSlotMeta(config);
    const publicPlans = getPublicPlans(config);

    slots.forEach((slot) => {
      const planKey = String(slot.dataset.plan || "basico").trim().toLowerCase();
      const card = slot.closest(".card");
      const serverMeta = normalizePlanMeta(publicPlans[planKey] || {}, planKey);
      const domMeta = readDomPlanMeta(slot);
      const planMeta = mergePlanMeta(domMeta, serverMeta) || domMeta || serverMeta;

      syncPlanCard(card, slot, planMeta, config);
      slot.innerHTML = "";

      const btn = document.createElement("a");
      btn.className = "btn motion-btn";
      btn.href = buildAccessHref(planMeta);
      btn.textContent = slotMeta.buttonText;
      btn.addEventListener("click", () => persistSelectedPlan(planMeta));
      slot.appendChild(btn);

      const note = document.createElement("div");
      note.className = "paypal-slot-note";
      note.textContent = `${slotMeta.note} ${formatUsd(planMeta?.montoUSD || 0)}`;
      slot.appendChild(note);
    });
  });
})();
