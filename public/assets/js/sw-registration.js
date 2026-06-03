(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var SW_URL = '/service-worker.js';
  var swReloadRequestedByUser = false;
  var toastDismissTimer = null;

  function crearToast() {
    var toast = document.createElement('div');
    toast.id = '__sw-update-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;background:#1e272e;color:#fff;padding:12px 18px;border-radius:10px;border-left:4px solid #05c46b;box-shadow:0 4px 18px rgba(0,0,0,0.45);font-family:Segoe UI,Arial,sans-serif;font-size:14px;max-width:calc(100vw - 32px);box-sizing:border-box';
    var texto = document.createElement('span');
    texto.textContent = 'Hay una nueva versión disponible';
    var btn = document.createElement('button');
    btn.textContent = 'Actualizar';
    btn.style.cssText = 'background:#05c46b;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0';
    var cerrar = document.createElement('button');
    cerrar.textContent = '✕';
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.style.cssText = 'background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:0 0 0 4px;line-height:1;flex-shrink:0';
    toast.appendChild(texto);
    toast.appendChild(btn);
    toast.appendChild(cerrar);
    return { toast: toast, btnActualizar: btn, btnCerrar: cerrar };
  }

  function ocultarToast(toast) {
    if (!toast) return;
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
    if (toastDismissTimer) { clearTimeout(toastDismissTimer); toastDismissTimer = null; }
  }

  function mostrarToast(worker) {
    if (window.__swToastShown) return;
    window.__swToastShown = true;
    var partes = crearToast();
    var toast = partes.toast;
    partes.btnActualizar.addEventListener('click', function () {
      swReloadRequestedByUser = true;
      ocultarToast(toast);
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    partes.btnCerrar.addEventListener('click', function () { ocultarToast(toast); });
    document.body.appendChild(toast);
    toastDismissTimer = setTimeout(function () { ocultarToast(toast); }, 30000);
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(SW_URL, { updateViaCache: 'none' })
      .then(function (registration) {
        if (registration.waiting) { mostrarToast(registration.waiting); }
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarToast(newWorker);
            }
          });
        });
        registration.update().catch(function () {});
      }).catch(function () {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!swReloadRequestedByUser) return;
    if (window.__swRefreshed) return;
    window.__swRefreshed = true;
    window.location.reload();
  });
})();
