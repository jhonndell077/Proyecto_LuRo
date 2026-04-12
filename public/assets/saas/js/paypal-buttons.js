(function () {
  const slots = Array.from(document.querySelectorAll(".paypal-button-slot"));
  if (!slots.length) return;

  slots.forEach((slot) => {
    const plan = String(slot.dataset.plan || "basico").trim().toLowerCase();
    slot.innerHTML = "";
    const btn = document.createElement("a");
    btn.className = "btn motion-btn";
    btn.href = `acceder.html?plan=${encodeURIComponent(plan)}`;
    btn.textContent = "Crear cuenta y suscribirme";
    slot.appendChild(btn);

    const card = slot.closest(".card");
    const fallback = card ? card.querySelector(".paypal-fallback-link") : null;
    if (fallback) fallback.style.display = "none";
  });
})();
