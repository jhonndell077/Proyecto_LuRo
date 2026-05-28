# Plan de Trabajo — Seguridad LuRo Control

**Fecha:** 2026-05-28  
**Versión:** 2.0 (post-implementación parcial)  
**Estado:** En progreso

---

## Resumen de Avance

### Ya implementado (PR #6 — mergeado a `main`)
| # | Vulnerabilidad | Archivo |
|---|----------------|---------|
| ✅ | Credenciales hardcodeadas eliminadas (`MASTER_USER`, `MASTER_PASS`, `PAYPAL_*`) | `functions/index.js` |
| ✅ | bcrypt en nuevas contraseñas + migración lazy al login | `functions/index.js` |
| ✅ | Rate limiting (5 intentos → bloqueo 15 min) en `authenticateSession` | `functions/index.js` |
| ✅ | Webhook PayPal falla seguro si `PAYPAL_WEBHOOK_ID` no configurado | `functions/index.js` |
| ✅ | Política de contraseñas mínima (6 caracteres) en backend | `functions/index.js` |
| ✅ | `sanitizeUsername`: rechaza caracteres especiales | `functions/index.js` |
| ✅ | Regla Firestore `/owners` restringida al propio dueño | `firestore.rules` |
| ✅ | Headers HTTP: HSTS, X-Frame-Options, nosniff, Referrer-Policy | `firebase.json` |
| ✅ | CVV eliminado del formulario y del objeto billing | `app.js` |
| ✅ | `prompt()` reemplazado por confirmación de texto en acciones destructivas | `app.js` |
| ✅ | `cambiarMiPassword` usa backend en lugar de comparación local | `app.js` |
| ✅ | SSRF en `DGII_RNC_PROXY`: validación de origen | `app.js` |
| ✅ | `window.rememberCloudAuth` eliminado del scope global | `cloud-bridge.js` |
| ✅ | `sessionStorage` password: expira 5 min + borrado one-time | `access.js` |
| ✅ | Username `'jssantana077'` hardcodeado eliminado | `cloud-bridge.js` |

### Pendiente de deploy
- **Functions**: Ejecutar `workflow_dispatch` con target `all` en GitHub Actions
- **Firestore rules**: Ejecutar `firebase deploy --only firestore:rules`
- **Variables de entorno**: Confirmar `MASTER_USER`, `MASTER_PASS`, `PAYPAL_RECEIVER`, `PAYPAL_ME_USER` en Firebase secrets

---

## Fase 0 — Deploy y Variables de Entorno (HOY)

> Sin esto, las funciones en producción siguen con el código antiguo.

### T-001: Configurar variables de entorno en Firebase
**Prioridad:** CRÍTICA  
**Tiempo estimado:** 15 minutos

```bash
# Verificar qué secrets existen
firebase functions:secrets:access MASTER_USER --project luro-control
firebase functions:secrets:access MASTER_PASS --project luro-control

# Crear si no existen (pide el valor de forma interactiva)
firebase functions:secrets:set MASTER_USER --project luro-control
firebase functions:secrets:set MASTER_PASS --project luro-control
firebase functions:secrets:set PAYPAL_RECEIVER --project luro-control
firebase functions:secrets:set PAYPAL_ME_USER --project luro-control
```

> **IMPORTANTE:** Si estas variables no existen, el login del super-master quedará deshabilitado en producción.

---

### T-002: Deploy completo (Functions + Hosting + Rules)
**Prioridad:** CRÍTICA  
**Tiempo estimado:** 10 minutos

**Opción A — GitHub Actions:**
1. Ir a: https://github.com/jhonndell077/Proyecto_LuRo/actions/workflows/deploy.yml
2. **Run workflow** → `deploy_target: all`, `ref: main`

**Opción B — CLI local:**
```bash
cd Proyecto_LuRo
firebase deploy --project luro-control --only functions,hosting,firestore:rules
```

---

## Fase 1 — Crítico en Frontend (Semana 1)

> El archivo `public/assets/js/app.js` (16,512 líneas) concentra el mayor riesgo restante.

### T-003: Eliminar `sesionUser.pass` de comparaciones de contraseña en `app.js`
**Prioridad:** CRÍTICA  
**Archivo:** `public/assets/js/app.js`  
**Instancias afectadas:** 19 líneas  
**Tiempo estimado:** 1 día

**Problema:** La contraseña del usuario en sesión se compara localmente en el cliente en múltiples puntos. Después de la migración a bcrypt, estas comparaciones **fallarán** para cualquier cuenta cuya contraseña haya sido actualizada al hash.

**Líneas a corregir:**

| Línea | Función | Acción correctiva |
|-------|---------|-------------------|
| 115 | `borrarTodoElAlmacen` en `app.js` interno | Ya corregido en root `app.js`; verificar este |
| 157 | `borrarTodoElMenu` | Igual — reemplazar con confirmación de texto |
| 231 | `cambiarMiPassword` interno | Igual — usar backend |
| 260 | actualización `sesionUser.pass` | Eliminar — el backend es la fuente de verdad |
| 1271 | entrada masiva | Reemplazar con `confirm()` explícito |
| 1601 | validación permiso | Mover a backend |
| 5070 | `verificarClave()` | Reescribir para no depender de `sesionUser.pass` |
| 6849, 7132, 7220 | múltiples secciones de facturación | Reemplazar con tipo de confirmación |
| 7475 | `accesoAutorizado` | Mover verificación al backend |
| 9002, 9313, 9528, 9844, 9864 | secciones de producción/inventario | Reemplazar con `confirm()` |
| 10036, 10110 | secciones de entradas | Reemplazar con `confirm()` |
| 4895 | actualización de `sesionUser.pass` | Eliminar |

**Estrategia de corrección:**
1. Para comparaciones de autorización de acciones críticas → reemplazar con un `confirm()` de texto explícito (ej: escribir `"CONFIRMAR"`)
2. Para actualizaciones de `sesionUser.pass` → eliminar; el objeto de sesión no debe contener la contraseña
3. Para `verificarClave()` usada como guard de módulos → convertir a verificación contra `cloudAuth` o token de sesión

---

### T-004: Eliminar `loginClave` como variable global de contraseña
**Prioridad:** CRÍTICA  
**Archivo:** `public/assets/js/app.js`  
**Líneas:** 3582, 5776-5777, 4397-4398, 4896-4897  
**Tiempo estimado:** 4 horas

**Problema:** `loginClave` almacena la contraseña en texto plano como variable global, accesible desde la consola del navegador.

```javascript
// Línea 3582 — declaración inicial
let loginClave = "";

// Líneas 5776-5777 — se asigna al hacer login
loginClave = passLogin;
window.loginClave = passLogin;  // ← Expuesto globalmente
```

**Corrección:**
1. Eliminar `window.loginClave = ...` (dejar solo la variable local)
2. En `cloud-bridge.js`, `getCurrentPassword()` ya lee de `window.loginClave` → actualizar para que use un getter seguro o un token
3. Inicializar `loginClave = ""` después del login exitoso (no guardar la contraseña en memoria)

---

### T-005: Corregir XSS en tablas de usuarios (`actualizarTablaUsuarios` / `actualizarTablaColaboradores`)
**Prioridad:** GRAVE  
**Archivo:** `public/assets/js/app.js`  
**Líneas:** ~657-673 y ~720-734  
**Tiempo estimado:** 3 horas

**Problema:** Los valores `u.user`, `c.user`, `c.owner` se insertan directamente en `innerHTML` dentro de handlers `onclick`, permitiendo XSS si un username contiene `'` o `"`.

**Corrección:**
1. Agregar función `escHtml(s)` al inicio del archivo:

```javascript
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

2. Aplicar `escHtml()` a todos los valores de usuario en templates de `innerHTML`:

```javascript
// Antes:
row.innerHTML = `<button onclick="toggleAccesoUsuarioMaestro('${u.user}')">`;

// Después:
row.innerHTML = `<button onclick="toggleAccesoUsuarioMaestro('${escHtml(u.user)}')">`;
```

3. Verificar las 121 instancias de `innerHTML =` en el archivo y aplicar `escHtml()` donde se use data externa.

---

### T-006: Corregir `prompt()` restantes en `app.js` y `asistencia-module.js`
**Prioridad:** GRAVE  
**Archivos:** `public/assets/js/app.js` (37 instancias), `public/assets/js/asistencia-module.js` (2 instancias)  
**Tiempo estimado:** 1 día

**Instancias críticas en asistencia-module.js:**

| Línea | Contexto | Corrección |
|-------|---------|------------|
| 899 | `prompt()` para clave de colaborador | Reemplazar con modal `<input type="password">` |
| 2356 | `prompt()` para clave maestra de asistencia | Reemplazar con modal + verificación backend |

**Instancias críticas en app.js (selección):**
- Comparaciones de contraseña: aplicar estrategia de T-003
- Inputs de WhatsApp (prompt para pedir número): reemplazar con campo de texto en modal

**Patrón de corrección para `prompt()` de contraseñas:**

```html
<!-- Agregar al HTML del módulo relevante -->
<dialog id="confirm-pass-dialog">
  <form method="dialog">
    <p id="confirm-pass-msg"></p>
    <input type="password" id="confirm-pass-input" autocomplete="current-password" placeholder="Contraseña">
    <div>
      <button type="button" onclick="resolveConfirmPass(false)">Cancelar</button>
      <button type="submit" onclick="resolveConfirmPass(true)">Confirmar</button>
    </div>
  </form>
</dialog>
```

```javascript
// Función helper reutilizable
function pedirConfirmacionConPassword(mensaje) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-pass-dialog');
    document.getElementById('confirm-pass-msg').textContent = mensaje;
    document.getElementById('confirm-pass-input').value = '';
    window._resolveConfirmPass = (confirmed) => {
      const val = confirmed ? document.getElementById('confirm-pass-input').value : null;
      dialog.close();
      resolve(val);
    };
    dialog.showModal();
  });
}
```

---

### T-007: Eliminar `pass` del response de `listMasterUsers` y `listTeamMembers`
**Prioridad:** GRAVE  
**Archivo:** `functions/index.js`  
**Líneas:** 2094, 2185  
**Tiempo estimado:** 3 horas

**Problema:** Las Cloud Functions devuelven la contraseña (o hash bcrypt) al frontend:

```javascript
// Línea 2094 — listMasterUsers
pass: String(data.pass || ""),

// Línea 2185 — listTeamMembers (función interna)
pass: String(it.pass || ""),
```

**Impacto:** Aunque con bcrypt el hash es menos peligroso que texto plano, los hashes de contraseñas **nunca deben enviarse al cliente**.

**Corrección:**
1. Eliminar `pass` de las respuestas de `listMasterUsers` y funciones relacionadas
2. En `cloud-bridge.js`, eliminar el uso de `f.pass` en `obtenerOwnerMaestroNube`
3. En `app.js`, eliminar el uso del `pass` recibido del cloud para auth local

**Nota de compatibilidad:** La función `sincronizarOwnersNubeALocal` en `app.js` (línea 3989) consume el `pass` del cloud. Una vez eliminado del response, esta función necesita actualización para no esperar ese campo.

---

### T-008: Corregir `sesionUser.pass` en `asistencia-module.js`
**Prioridad:** GRAVE  
**Archivo:** `public/assets/js/asistencia-module.js`  
**Líneas:** 527, 2285, 2353  
**Tiempo estimado:** 2 horas

```javascript
// Línea 527 — envía contraseña a backend de asistencia
masterPassword: String((sesionUser && sesionUser.pass) || '').trim(),

// Líneas 2285, 2353 — config de asistencia usa contraseña
config.masterPassword = String((sesionUser && sesionUser.pass) || '').trim();
```

**Corrección:**
1. El módulo de asistencia debe autenticar usando el sistema de sesión cloud (token), no la contraseña en texto plano
2. Reemplazar `sesionUser.pass` con llamada a `window.autenticarSesionBackend()` y usar el resultado como token

---

## Fase 2 — Arquitectura de Autenticación (Semana 2–3)

> Estas tareas requieren cambios coordinados entre backend y frontend. Son la raíz de los problemas del frontend.

### T-009: Implementar sesión basada en tokens (eliminar password-per-request)
**Prioridad:** CRÍTICA (arquitectural)  
**Archivos:** `functions/index.js`, `public/assets/js/cloud-bridge.js`, `public/assets/js/app.js`  
**Tiempo estimado:** 3–4 días

**Problema raíz:** El sistema envía `authPassword` (contraseña en texto plano) con **cada request** al backend. La contraseña vive en memoria (`cloudAuth.password`, `loginClave`, `sesionUser.pass`) durante toda la sesión.

**Diseño propuesto:**

```
┌─────────────────────────────────────────────────┐
│ ACTUAL                                          │
│ Frontend → POST {authUsername, authPassword}   │
│ Backend → verifica contraseña en cada call     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PROPUESTO                                       │
│ 1. Login: POST {username, password}             │
│    → Backend devuelve sessionToken (JWT/UUID)   │
│    → Token almacenado en memoria (no en DB)     │
│ 2. Requests: POST {sessionToken}                │
│    → Backend valida token, no contraseña        │
│ 3. Token expira en 8h o al cerrar sesión        │
└─────────────────────────────────────────────────┘
```

**Pasos de implementación:**

**Backend:**
1. Crear colección `_sessions` en Firestore con: `token`, `owner`, `username`, `role`, `expiresAt`
2. En `authenticateSession`, generar y guardar el token en `_sessions`
3. Devolver el token al frontend en la respuesta
4. Crear función `resolveSessionByToken(token)` para validar en cada request
5. Modificar `resolveSession()` para aceptar `authToken` en lugar de `authPassword`
6. Agregar `exports.logout` que invalida el token en Firestore

**Frontend:**
1. En `cloud-bridge.js`, almacenar el token (no la contraseña) después del login
2. Modificar `postCallableWithSession()` para enviar `authToken` en lugar de `authPassword`
3. Eliminar `cloudAuth.password`, `loginClave`, `sesionUser.pass` del flujo de requests
4. El token debe vivir **solo en memoria** (no en `localStorage` ni `sessionStorage`)

---

### T-010: Migración completa a bcrypt — frontend local auth
**Prioridad:** ALTA  
**Archivos:** `public/assets/js/app.js`, `public/assets/js/cloud-bridge.js`  
**Tiempo estimado:** 2 días  
**Dependencia:** T-009

**Problema:** Las comparaciones locales de contraseña (`sesionUser.pass === input`) se romperán para cuentas con bcrypt. Una vez que T-009 esté implementado (tokens), todas las comparaciones locales dejan de ser necesarias y pueden ser eliminadas.

**Tarea:** Después de T-009, eliminar **todas** las referencias a `sesionUser.pass`, `loginClave` y `window.loginClave` del frontend. El objeto `sesionUser` solo debe contener `user`, `role`, `owner`, `permisos`, `canCreateAdmins`. Sin contraseña.

---

## Fase 3 — Funcionalidades de Seguridad (Semana 3–4)

### T-011: Sistema de audit log
**Prioridad:** ALTA  
**Archivo:** `functions/index.js`  
**Tiempo estimado:** 1 día

Crear una colección `_audit_log` en Firestore con escritura solo desde Cloud Functions:

```javascript
async function auditLog(event, actor, details = {}) {
  await db.collection("_audit_log").add({
    event,       // 'login_ok', 'login_fail', 'password_change', 'user_delete', etc.
    actor,       // username que ejecutó la acción
    owner: details.owner || actor,
    details,
    at: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

**Eventos a registrar:**
- Login exitoso / fallido (con IP si disponible)
- Cambio de contraseña
- Creación/eliminación de usuario/colaborador
- Activación/suspensión de cuenta
- Acceso denegado (permission-denied)
- Pago confirmado / webhook recibido

**Reglas Firestore para audit_log:**
```javascript
match /_audit_log/{docId} {
  allow read: if isSuperMaster();
  allow create, update, delete: if false; // Solo Cloud Functions
}
```

---

### T-012: Autenticación multifactor (MFA) para administradores
**Prioridad:** ALTA  
**Archivos:** `functions/index.js`, módulo de login en `public/`  
**Tiempo estimado:** 2–3 días

**Implementación con Firebase Authentication:**

1. Habilitar TOTP (Time-based One-Time Password) en Firebase Console → Authentication → Multi-factor
2. En `authenticateSession`, verificar el claim `mfa_verified: true` del token de Firebase Auth
3. Para cuentas con rol `admin` o `super-master`, requerir MFA obligatoriamente
4. En el frontend de login, agregar paso de verificación TOTP después de usuario/contraseña

**Nota:** Requiere que los usuarios usen Google Authenticator o Authy.

---

### T-013: Content Security Policy (CSP)
**Prioridad:** ALTA  
**Archivo:** `firebase.json`  
**Tiempo estimado:** 4 horas

El header `Content-Security-Policy` requiere inventariar todos los scripts y recursos externos antes de activarlo. Activarlo incorrectamente rompe la app.

**Proceso:**
1. Activar CSP en modo `Report-Only` primero:
```json
{ "key": "Content-Security-Policy-Report-Only",
  "value": "default-src 'self'; script-src 'self' https://www.paypalobjects.com https://www.paypal.com; connect-src 'self' https://*.cloudfunctions.net https://firestore.googleapis.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; report-uri /csp-report" }
```
2. Revisar los reportes durante 1 semana
3. Ajustar la política según los reportes
4. Cambiar a modo activo

---

### T-014: Cifrado de datos sensibles en localStorage
**Prioridad:** MEDIA  
**Archivo:** `public/assets/js/app.js`  
**Tiempo estimado:** 1 día

La base de datos local (guardada en `localStorage`) contiene información del negocio. Usar Web Crypto API para cifrar antes de guardar:

```javascript
async function encryptForStorage(data, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}
```

La clave de cifrado se deriva de un secreto del usuario + el UID de Firebase Auth.

---

### T-015: Política de contraseñas en frontend + indicador de fortaleza
**Prioridad:** MEDIA  
**Archivos:** HTML de registro/cambio de contraseña  
**Tiempo estimado:** 3 horas

El backend ya valida mínimo 6 caracteres. Agregar en el frontend:
1. Indicador visual de fortaleza (débil/media/fuerte)
2. Validación en tiempo real: mínimo 8 caracteres, una mayúscula, un número
3. Bloquear contraseñas comunes (top-100 lista)

---

### T-016: Protección CSRF en endpoints `onRequest`
**Prioridad:** MEDIA  
**Archivo:** `functions/index.js`  
**Tiempo estimado:** 3 horas

Las funciones tipo `onRequest` (webhooks de PayPal) deben verificar el header `Origin` para requests que no vienen de PayPal:

```javascript
function assertSafeOrigin(req) {
  const origin = String(req.headers.origin || '');
  const allowed = ['https://luro-control.web.app', 'https://luro-control.firebaseapp.com'];
  if (origin && !allowed.includes(origin)) {
    throw new HttpsError('permission-denied', 'Origen no permitido.');
  }
}
```

---

## Fase 4 — Hardening Adicional (Semana 4–6)

### T-017: Validación de username con regex estricta en frontend
**Prioridad:** MEDIA  
**Archivos:** formularios de creación de usuarios  
**Tiempo estimado:** 2 horas

El backend ya rechaza caracteres especiales. Agregar la misma validación en el frontend antes de enviar:

```javascript
function validarUsername(u) {
  return /^[a-z0-9._@\-+]{3,80}$/.test(String(u || '').trim().toLowerCase());
}
```

---

### T-018: Rotación automática de contraseña comprometida
**Prioridad:** MEDIA  
**Archivo:** `functions/index.js`  
**Tiempo estimado:** 1 día

Integrar con la API de HaveIBeenPwned para rechazar contraseñas conocidas como comprometidas:

```javascript
async function isPasswordPwned(password) {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await resp.text();
  return text.includes(hash.slice(5));
}
```

---

### T-019: Expiración automática de sesiones inactivas
**Prioridad:** MEDIA  
**Dependencia:** T-009 (tokens)  
**Tiempo estimado:** 4 horas

Una vez implementados los tokens (T-009), agregar:
1. Expiración de token después de 8 horas de inactividad
2. Refresh automático si el usuario está activo
3. Logout forzado en todos los dispositivos al cambiar contraseña

---

### T-020: Eliminar historial Git con credenciales comprometidas
**Prioridad:** BAJA (ya no hay credenciales activas en el repo)  
**Tiempo estimado:** 30 minutos

Las credenciales `jssantana077:160623` y emails de PayPal siguen en el historial de Git. Si el repositorio alguna vez fue o será público:

```bash
# Reescribir historia eliminando las líneas comprometidas
git filter-branch --tree-filter '
  sed -i "s/jssantana077//g" functions/index.js
  sed -i "s/160623//g" functions/index.js
  sed -i "s/Jssantana077@gmail.com//g" functions/index.js
' -- --all

# O usar BFG Repo Cleaner (más rápido)
java -jar bfg.jar --replace-text passwords.txt repo.git
```

---

## Resumen de Hoja de Ruta

```
Semana 1      Semana 2      Semana 3      Semana 4-6
────────────  ────────────  ────────────  ─────────────────
T-001 Deploy  T-009 Tokens  T-011 Audit   T-014 LocalStorage
T-002 Deploy  T-010 bcrypt  T-012 MFA     T-015 PassPolicy
T-003 Pass    T-007 API     T-013 CSP     T-016 CSRF
T-004 Global  T-008 Asist.  T-017 Valid.  T-018 HaveIBeen
T-005 XSS                  T-019 Sesion  T-020 GitHistory
T-006 Prompt
```

---

## Riesgos y Dependencias Críticas

| Riesgo | Mitigación |
|--------|------------|
| T-001 no se hace → login maestro roto en prod | Hacer HOY antes del deploy de functions |
| T-009 es complejo → bloquea T-010 | Puede hacerse en ramas separadas, bcrypt lazy sigue funcionando |
| CSP rompe app si se activa sin inventario | Usar `Report-Only` primero |
| Reescritura de historia Git rompe forks | Coordinar con todos los colaboradores |

---

## Criterios de Aceptación General

Para considerar la seguridad del sistema como **aceptable para producción**:

- [ ] T-001 y T-002 completados (deploy con env vars)
- [ ] T-003 y T-004 completados (sin `sesionUser.pass` en comparaciones)
- [ ] T-005 completado (sin XSS en tablas)
- [ ] T-007 completado (API no devuelve contraseñas)
- [ ] T-009 completado (tokens en lugar de contraseñas por request)
- [ ] T-011 completado (audit log activo)
- [ ] Sin `window.loginClave` ni `window.sesionUser.pass` expuestos globalmente

