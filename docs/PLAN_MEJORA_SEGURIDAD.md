# Plan de Mejora de Seguridad — LuRo Control

**Fecha:** 2026-05-27  
**Proyecto:** LuRo Control SaaS  
**Alcance:** Análisis completo de vulnerabilidades y hoja de ruta de remediación

---

## Resumen Ejecutivo

El análisis identificó **5 vulnerabilidades críticas**, **15+ graves** y **10+ moderadas**. Las áreas de mayor riesgo son: manejo de credenciales en texto plano, ausencia de hashing de contraseñas, exposición de datos de tarjetas de crédito (violación PCI-DSS), XSS almacenado en múltiples vistas, y credenciales maestras hardcodeadas con valores por defecto inseguros.

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| Crítica   | 5        | Sin mitigar |
| Grave     | 15       | Sin mitigar |
| Moderada  | 10       | Sin mitigar |

---

## Fase 1 — Crítico (Inmediato, 0–2 semanas)

### VULN-001: Credenciales maestras hardcodeadas

**Archivo:** `functions/index.js` líneas 8–9  
**Código actual:**
```javascript
const MASTER_USER = String(process.env.MASTER_USER || "jssantana077").trim().toLowerCase();
const MASTER_PASS = String(process.env.MASTER_PASS || "160623");
```

**Riesgo:** Si las variables de entorno no están configuradas, el sistema usa credenciales conocidas públicamente, permitiendo acceso total al backend.

**Remediación:**
1. Eliminar los valores por defecto hardcodeados completamente.
2. Si la variable de entorno no existe, lanzar error al iniciar la función.
3. Rotar las credenciales comprometidas inmediatamente.

```javascript
const MASTER_USER = (() => {
  const v = String(process.env.MASTER_USER || "").trim().toLowerCase();
  if (!v) throw new Error("MASTER_USER env var is required");
  return v;
})();
const MASTER_PASS = (() => {
  const v = String(process.env.MASTER_PASS || "").trim();
  if (!v) throw new Error("MASTER_PASS env var is required");
  return v;
})();
```

---

### VULN-002: Contraseñas almacenadas en texto plano

**Archivos:** `functions/index.js`, Firestore colección `autorizaciones`  
**Riesgo:** Un atacante con acceso a Firestore (o a un backup) obtiene todas las contraseñas directamente. Viola GDPR y buenas prácticas básicas.

**Remediación:**
1. Agregar la librería `bcrypt` al proyecto de Cloud Functions.
2. Al crear o actualizar usuarios, hashear la contraseña antes de guardar.
3. Al autenticar, comparar con `bcrypt.compare()`.
4. Ejecutar una migración única para hashear contraseñas existentes.

```javascript
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12;

// Al guardar:
const hashedPass = await bcrypt.hash(rawPassword, SALT_ROUNDS);

// Al verificar:
const match = await bcrypt.compare(inputPassword, storedHash);
```

---

### VULN-003: Datos de tarjeta de crédito capturados en frontend

**Archivos:** `public/assets/js/app.js` líneas 374–395  
**Riesgo:** Número de tarjeta, fecha de vencimiento y CVV se procesan y almacenan en el cliente. Violación directa de PCI-DSS SAQ D. El CVV nunca debe ser almacenado bajo ninguna circunstancia.

**Remediación:**
1. Reemplazar el formulario manual de tarjeta por Stripe Elements o PayPal Hosted Fields (ya se usa PayPal en el proyecto).
2. Nunca tocar el número completo ni el CVV desde JavaScript propio.
3. Almacenar únicamente el token devuelto por el proveedor de pago.
4. Eliminar los campos `new_u_card`, `new_u_card_cvv` del HTML.

```javascript
// CORRECTO: usar solo el token de Stripe/PayPal
window.__nuevoUsuarioPagoTemp = {
  clientName,
  paymentMethod,
  paymentToken: stripeToken.id,  // Solo el token
  nextChargeAt: dt.toISOString(),
  billingDay: dt.getDate()
};
```

---

### VULN-004: Validación de webhook PayPal bypasseable

**Archivo:** `functions/index.js` línea 630  
**Código actual:**
```javascript
async function verifyPayPalWebhook(req, eventBody) {
  const webhookId = getPaypalWebhookId();
  if (!webhookId) return true;  // Acepta CUALQUIER webhook si no está configurado
  ...
}
```

**Riesgo:** Si `PAYPAL_WEBHOOK_ID` no está configurado como variable de entorno, cualquier request externo al endpoint de webhook es aceptado como legítimo, permitiendo activar suscripciones de forma fraudulenta.

**Remediación:**
```javascript
async function verifyPayPalWebhook(req, eventBody) {
  const webhookId = getPaypalWebhookId();
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID no configurado — rechazando webhook");
    return false;  // FALLAR seguro, nunca pasar
  }
  ...
}
```

---

### VULN-005: Información personal y cuentas de pago hardcodeadas en código

**Archivo:** `functions/index.js` líneas 12–13  
**Código actual:**
```javascript
const PAYPAL_RECEIVER = String(process.env.PAYPAL_RECEIVER || "Jssantana077@gmail.com");
const PAYPAL_ME_USER = String(process.env.PAYPAL_ME_USER || "Jhonn0723");
```

**Riesgo:** Email personal y usuario de PayPal expuestos en el repositorio de código, visible en historial de Git para siempre, incluso si se eliminan.

**Remediación:**
1. Eliminar los valores por defecto.
2. Requerir explícitamente las variables de entorno.
3. Revisar el historial de Git con `git log -S "Jssantana077"` y considerar reescritura de historia si el repo es público.

---

## Fase 2 — Grave (Corto plazo, 2–6 semanas)

### VULN-006: XSS Almacenado via innerHTML con datos de usuario

**Archivos:** `public/assets/js/app.js` (tablas de usuarios), `public/assets/js/cloud-bridge.js` (listas de sucursales)  
**Ejemplo:**
```javascript
row.innerHTML = `<button onclick="toggleAccesoUsuarioMaestro('${u.user}')">`;
```

**Riesgo:** Un nombre de usuario como `'); alert(document.cookie); ('` ejecutaría JavaScript en el contexto de todos los usuarios que vean esa tabla.

**Remediación:**
1. Reemplazar `innerHTML` por creación de elementos DOM (`document.createElement`).
2. Usar `textContent` para insertar datos de usuario, nunca interpolación de strings.
3. Agregar una función de sanitización central para cualquier dato externo que deba ir a HTML.

```javascript
// MAL:
row.innerHTML = `<button onclick="fn('${u.user}')">`;

// BIEN:
const btn = document.createElement('button');
btn.textContent = u.user;
btn.addEventListener('click', () => fn(u.user));
row.appendChild(btn);
```

---

### VULN-007: Contraseña comparada en texto plano en frontend

**Archivo:** `app.js` líneas 15, 49  
**Código actual:**
```javascript
if (passwordIngresada !== sesionUser.pass) {
```

**Riesgo:** La contraseña del usuario está disponible en memoria del navegador como texto plano (en `sesionUser.pass`). Cualquier extensión, snippet de consola o XSS puede extraerla.

**Remediación:**
1. Las validaciones de contraseña deben hacerse exclusivamente en el backend.
2. Para acciones críticas (borrado masivo), enviar un request autenticado a Cloud Functions que verifique la contraseña con bcrypt.
3. El objeto `sesionUser` en frontend nunca debe contener `pass`.

---

### VULN-008: Credenciales almacenadas en objeto global `window`

**Archivo:** `public/assets/js/cloud-bridge.js` líneas 43–58  
**Código actual:**
```javascript
cloudAuth = { username: u, password: p, ... };
window.rememberCloudAuth = rememberCloudAuth;
```

**Riesgo:** La contraseña en texto plano está accesible desde la consola del navegador con `window.rememberCloudAuth` o inspeccionando `cloudAuth`. Una extensión maliciosa o XSS la extrae trivialmente.

**Remediación:**
1. No almacenar contraseñas en variables globales del cliente después del login.
2. El backend debe emitir un token de sesión (JWT o Firebase Custom Token) que el cliente usa para requests posteriores.
3. Eliminar `window.rememberCloudAuth` de la API pública.

---

### VULN-009: Credenciales en sessionStorage

**Archivo:** `public/assets/saas/js/access.js` líneas 56–67  
**Código actual:**
```javascript
const raw = sessionStorage.getItem("LURO_SAAS_PENDING_LOGIN");
const parsed = JSON.parse(raw);
const pass = String(parsed?.pass || "");
```

**Riesgo:** `sessionStorage` es accesible por cualquier script del mismo origen. Un XSS exitoso puede leer la contraseña directamente.

**Remediación:**
1. No almacenar contraseñas en `sessionStorage` ni `localStorage`.
2. Para pasar estado entre páginas durante el login, usar `sessionStorage` solo para el nombre de usuario (no contraseña) y re-autenticar en la página destino.

---

### VULN-010: Regla de Firestore permite leer todos los owners

**Archivo:** `firestore.rules` línea 20  
**Código actual:**
```javascript
match /owners/{ownerId} {
  allow read: if signedIn();  // Cualquier usuario autenticado
}
```

**Riesgo:** Un colaborador de un negocio puede leer los datos de todos los demás owners del sistema (nombres, emails, configuración).

**Remediación:**
```javascript
match /owners/{ownerId} {
  allow read: if signedIn() && (isSuperMaster() || ownerClaim() == ownerId);
  allow create, update, delete: if false;
}
```

---

### VULN-011: Sin rate limiting en endpoints de autenticación

**Archivo:** `functions/index.js` (función `authenticateSession`)  
**Riesgo:** Un atacante puede hacer miles de intentos de login por segundo sin restricción, permitiendo ataques de fuerza bruta y credential stuffing.

**Remediación:**
1. Implementar rate limiting por IP usando Firebase App Check o un middleware de conteo en Firestore.
2. Bloquear temporalmente (lockout) una cuenta tras N intentos fallidos consecutivos.
3. Registrar intentos fallidos con timestamp, IP y username.

```javascript
// Ejemplo de lockout simple en Firestore
async function checkRateLimit(username, ip) {
  const key = `ratelimit_${username}_${ip}`;
  const ref = db.collection("_security").doc(key);
  const doc = await ref.get();
  const data = doc.data() || { attempts: 0, lockedUntil: 0 };
  
  if (Date.now() < data.lockedUntil) {
    throw new HttpsError("resource-exhausted", "Cuenta temporalmente bloqueada.");
  }
  if (data.attempts >= 5) {
    await ref.set({ attempts: data.attempts + 1, lockedUntil: Date.now() + 15 * 60 * 1000 });
    throw new HttpsError("resource-exhausted", "Demasiados intentos fallidos.");
  }
  return ref;
}
```

---

### VULN-012: Contraseñas visibles vía `prompt()` del navegador

**Archivo:** `app.js` líneas 10, 45, 296  
**Riesgo:** `prompt()` no oculta el texto ingresado. La contraseña es visible en pantalla para cualquier persona cerca, queda en el historial de algunas herramientas de debug, y es accesible en algunas implementaciones de automatización.

**Remediación:**
Reemplazar `prompt()` con un modal HTML que use `<input type="password">`.

```html
<dialog id="confirm-password-dialog">
  <form method="dialog">
    <label>Ingrese su contraseña:
      <input type="password" id="confirm-password-input" autocomplete="current-password">
    </label>
    <button type="submit">Confirmar</button>
  </form>
</dialog>
```

---

### VULN-013: SSRF / Open Redirect via URL en localStorage

**Archivo:** `app.js` línea 574  
**Código actual:**
```javascript
const DGII_RNC_PROXY = localStorage.getItem('DGII_RNC_PROXY') 
    || 'http://localhost:8787/api/dgii/rnc';
```

**Riesgo:** Un atacante que logre XSS puede escribir en `localStorage` una URL arbitraria (incluyendo `http://interno.red/secretos`), haciendo que el cliente haga requests a destinos no previstos.

**Remediación:**
1. Validar que la URL de proxy pertenece a dominios permitidos antes de usarla.
2. Considerar mover esta configuración a una constante en código, no en localStorage.

```javascript
const ALLOWED_PROXY_ORIGINS = ['https://proxy.lurocontrol.com', 'http://localhost:8787'];
const rawProxy = localStorage.getItem('DGII_RNC_PROXY') || 'http://localhost:8787/api/dgii/rnc';
try {
  const url = new URL(rawProxy);
  const DGII_RNC_PROXY = ALLOWED_PROXY_ORIGINS.includes(url.origin) ? rawProxy : null;
} catch {
  const DGII_RNC_PROXY = null;
}
```

---

### VULN-014: Sin headers de seguridad HTTP

**Archivo:** `firebase.json` / `netlify.toml`  
**Riesgo:** Ausencia de Content-Security-Policy, X-Frame-Options, X-Content-Type-Options y Strict-Transport-Security expone la aplicación a clickjacking, MIME sniffing y ataques de degradación de protocolo.

**Remediación en `firebase.json`:**
```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://www.paypalobjects.com; connect-src 'self' https://*.cloudfunctions.net https://firestore.googleapis.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'" }
        ]
      }
    ]
  }
}
```

---

### VULN-015: CVV almacenado aunque sea "enmascarado"

**Archivo:** `public/assets/js/app.js` línea 389  
**Código actual:**
```javascript
cvvMasked: '*'.repeat(cardCvv.length),
```

**Riesgo:** Almacenar incluso la longitud del CVV está en el límite de PCI-DSS. El CVV debe ser descartado inmediatamente después de la transacción; nunca almacenado.

**Remediación:**
Eliminar el campo `cvvMasked` completamente del objeto de billing. El CVV solo existe durante la transacción en el SDK del proveedor de pagos.

---

## Fase 3 — Moderado (Mediano plazo, 6–12 semanas)

### VULN-016: Sin autenticación multifactor (MFA)

**Riesgo:** Las cuentas son vulnerables a credential stuffing y phishing. Una contraseña comprometida equivale a cuenta comprometida.

**Remediación:**
1. Habilitar Firebase Authentication con TOTP (Google Authenticator).
2. Hacer MFA obligatorio para cuentas con rol `admin` y `superMaster`.
3. Notificar por email nuevos logins desde dispositivos no reconocidos.

---

### VULN-017: Sin logging de eventos de seguridad

**Riesgo:** No hay visibilidad de intentos de acceso fallidos, cambios de permisos, o acciones destructivas. Un ataque en curso no sería detectable.

**Remediación:**
1. Crear colección `_audit_log` en Firestore (solo escritura desde Cloud Functions, sin lectura directa del cliente).
2. Registrar: login exitoso, login fallido, cambio de contraseña, borrado de datos, cambio de roles.
3. Configurar alertas en Firebase Alerting o Google Cloud Monitoring.

```javascript
async function auditLog(event, owner, actor, details = {}) {
  await db.collection("_audit_log").add({
    event,
    owner,
    actor,
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ip: details.ip || "unknown"
  });
}
```

---

### VULN-018: Información sensible en localStorage sin cifrado

**Riesgo:** `localStorage` no está cifrado. En un dispositivo compartido, número de WhatsApp, configuraciones y preferencias del negocio son accesibles para cualquier usuario del sistema operativo.

**Remediación:**
1. Usar la Web Crypto API para cifrar datos sensibles antes de escribirlos en `localStorage`.
2. Alternativamente, mover datos de configuración sensibles a Firestore (protegidos por autenticación).

---

### VULN-019: Exposición del Project ID de Firebase

**Archivo:** `.firebaserc`, `public/assets/js/cloud-bridge.js` línea 3  
**Riesgo:** El Project ID `luro-control` está hardcodeado y en el repositorio. Si bien no es una credencial en sí mismo, reduce la barrera para ataques dirigidos.

**Remediación:**
1. Mover el Project ID a una variable de entorno en el proceso de build.
2. Asegurarse que las Firebase Security Rules sean la única barrera de acceso (no la oscuridad del Project ID).

---

### VULN-020: Sin política de contraseñas

**Riesgo:** El sistema acepta contraseñas como "1234" o "abc". Las credenciales por defecto comprometidas (`160623`) sugieren que no hay validación de fortaleza.

**Remediación:**
1. Mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial.
2. Rechazar contraseñas del top-1000 de contraseñas más comunes.
3. Implementar tanto en frontend (UX inmediata) como en backend (validación final).

---

### VULN-021: Sin protección CSRF en Cloud Functions

**Riesgo:** Las Cloud Functions `onCall` de Firebase incluyen verificación de origen por defecto, pero las funciones `onRequest` (como el webhook de PayPal) no tienen CSRF tokens, dependiendo solo de validación de origen.

**Remediación:**
1. Verificar el header `Origin` en todas las funciones `onRequest` que no sean webhooks externos.
2. Para webhooks externos (PayPal), verificar la firma criptográfica del proveedor (ya implementado parcialmente en VULN-004).

---

## Checklist de Implementación por Prioridad

### Semana 1–2 (Crítico)
- [ ] Eliminar credenciales hardcodeadas en `functions/index.js` (VULN-001, VULN-005)
- [ ] Corregir `verifyPayPalWebhook` para fallar seguro (VULN-004)
- [ ] Instalar bcrypt en Cloud Functions (VULN-002)
- [ ] Iniciar migración de contraseñas a hashes (VULN-002)
- [ ] Reemplazar formulario de tarjeta por PayPal Hosted Fields (VULN-003)
- [ ] Rotar credenciales comprometidas: MASTER_USER, MASTER_PASS, PAYPAL_RECEIVER

### Semana 3–4 (Grave — Autenticación)
- [ ] Eliminar `password` de `cloudAuth` en frontend (VULN-008)
- [ ] Eliminar contraseñas de `sessionStorage` (VULN-009)
- [ ] Corregir regla Firestore `owners` (VULN-010)
- [ ] Implementar rate limiting en `authenticateSession` (VULN-011)
- [ ] Reemplazar `prompt()` con modal de contraseña (VULN-012)

### Semana 5–6 (Grave — Inyección y Frontend)
- [ ] Sanitizar todos los `innerHTML` con datos de usuario (VULN-006)
- [ ] Eliminar `sesionUser.pass` del objeto de sesión en frontend (VULN-007)
- [ ] Validar URL de `DGII_RNC_PROXY` (VULN-013)
- [ ] Agregar headers de seguridad HTTP (VULN-014)
- [ ] Eliminar campo `cvvMasked` (VULN-015)

### Semana 7–12 (Moderado)
- [ ] Implementar MFA para cuentas admin (VULN-016)
- [ ] Crear sistema de audit log (VULN-017)
- [ ] Cifrar datos sensibles en localStorage (VULN-018)
- [ ] Parametrizar Project ID (VULN-019)
- [ ] Implementar política de contraseñas (VULN-020)
- [ ] Revisar CSRF en funciones `onRequest` (VULN-021)

---

## Dependencias Técnicas a Instalar

```bash
# Cloud Functions
cd functions
npm install bcrypt         # Hashing de contraseñas
npm install express-rate-limit  # Si se migra a onRequest

# Frontend (via CDN o bundler)
# Stripe.js o PayPal JS SDK para Hosted Fields (ya parcialmente integrado)
```

---

## Referencias

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [PCI-DSS v4.0 — Requisito 3: Proteger datos almacenados del titular](https://www.pcisecuritystandards.org/)
- [Firebase Security Rules Best Practices](https://firebase.google.com/docs/rules/basics)
- [NIST SP 800-63B — Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [bcrypt para Node.js](https://www.npmjs.com/package/bcrypt)
