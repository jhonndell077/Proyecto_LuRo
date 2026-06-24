# LuRo Control — Guía del proyecto (ideología de trabajo)

> Documento canónico de cómo trabaja este proyecto. Toda configuración y todo cambio
> deben quedar **sincronizados con esta ideología**. Si algo en el repo contradice este
> documento, este documento manda (o el documento se actualiza de forma deliberada).

## 1. Qué es LuRo Control

Sistema de gestión para operar un negocio (restaurante/cocina) con tres principios rectores:

- **Orden · Control · Rentabilidad.**
- **Almacén es la base del flujo.** Inventario alimenta producción, disponibilidad y ventas.
- **Módulos conectados en tiempo real.** Cada plato queda alineado a costos, inventario y
  disponibilidad. Nada se ofrece sin respaldo de stock.

El **Asistente LuRo** es un copiloto que consulta información, navega módulos y ejecuta
**solo órdenes reales conectadas al sistema** (nunca acciones inventadas).

## 2. Fuente de verdad — qué es canónico y qué NO

**Lo único que se despliega es `public/`** (ver `firebase.json` → `hosting.public: "public"`).
Edita SIEMPRE dentro de `public/`.

| Ruta | Estado | Nota |
|------|--------|------|
| `public/` | ✅ **CANÓNICO / desplegado** | Único origen que llega a Firebase Hosting |
| `functions/` | ✅ **CANÓNICO** | Backend (Cloud Functions v2): auth, PayPal/Stripe, masters, equipos |
| `index.html` (raíz) | ⚠️ Scratch / NO desplegado | Copia de trabajo (~11.6k líneas). No es lo que sale a producción |
| `index.html.html` | 🗑️ Basura | Backup con doble extensión |
| `app.js`, `styles.css` (raíz) | ⚠️ Legacy | Distintos y desactualizados respecto a `public/` |
| `Repositorio1/` | ⚠️ Repo anidado duplicado | Copia casi completa del proyecto. Riesgo alto de deriva |
| `NEWPROYECTO/` | ⚠️ Carpeta de trabajo | No canónica |
| `public/velvet-site/` + `public/velvet-admin/` | ✅ **CANÓNICO (otro producto)** | Fuente del sitio/admin "La Foca Cheria" (storefront), separado del panel LuRo |
| `.deploy-lafocacheria/` | ✅ **Publicación (no borrar)** | Copia plana de velvet-site+admin; su `firebase.json` despliega el site **`lafocacheria`**. Se sincroniza a mano desde `public/velvet-*` |
| `luro_v7/v8/v9/v9b.html_snippet`, `luro_script_v4.js` | ⚠️ Iteraciones | Snippets del overlay embebible |
| `.codex-temp/` | 🗑️ Temporal | Perfiles de Chrome de depuración + JSON de prueba (debería ignorarse en git) |

> **Regla:** no edites las copias scratch/legacy esperando que afecten producción. Si una idea
> nace ahí, pórtala a `public/` y borra la copia.

## 3. Arquitectura de la app (dentro de `public/`)

- `public/index.html` — landing/loader (347 líneas).
- `public/app.html` — **shell de la aplicación** (2.4k líneas). Carga, con *cache-busting* `?v=`:
  - `assets/js/app.js` — **el sistema completo** (~16.8k líneas): todos los módulos + el
    **Centro de comandos LuRo** (asistente determinista).
  - `assets/js/asistencia-module.js` — módulo de asistencia/sucursales.
  - `assets/js/cloud-bridge.js` — sincronización con Cloud Functions (polling 20–30 s).
  - Bloque `<script>` inline en `app.html` — **Asistente IA por voz** (Groq + Whisper + TTS).
- Navegación: `showPage(pageId)` activa la `.content-section#<pageId>`. Algunas secciones
  (p. ej. `comandas`) se **inyectan dinámicamente** en `DOMContentLoaded` — no están en el HTML
  estático, pero existen en runtime.

## 4. Los DOS asistentes (deben permanecer sincronizados)

LuRo tiene **dos** subsistemas de asistente. Comparten los mismos módulos reales:

1. **Centro de comandos LuRo** (determinista) — en `app.js` (`(() => { ... })()`, "Centro de
   comandos LuRo"). Sin red, sin LLM. Registro canónico de módulos en `ASSISTANT_PAGES`
   (24 módulos: page + aliases + description), más `ASSISTANT_COMMAND_LIBRARY`,
   `ASSISTANT_MODULE_GUIDES` y `ASSISTANT_ACTIONS`.
2. **Asistente IA por voz** (LLM) — bloque inline en `app.html`. Llama a **Groq**
   (`llama-3.3-70b-versatile`, fallback `llama-3.1-8b-instant`, audio `whisper-large-v3-turbo`).
   Devuelve **tags de acción** al final de su respuesta que el front intercepta:
   `[NAV:id]`, `[MODULO:NOMBRE]`, `[ENTRADA:p:c:u]`, `[DIST_NUEVO:…]`, `[CLIENTE_NUEVO:…]` y los
   **críticos** `[LIMPIAR:…]`, `[ELIMINAR_DIST|ALMACEN|PLATO:…]` (estos piden confirmación).

> **Invariante de sincronización:** la lista `[NAV:id]` del prompt IA (`app.html`) y el conjunto
> de `page` de `ASSISTANT_PAGES` (`app.js`) **deben listar los mismos módulos** y, a su vez,
> coincidir con las secciones reales que acepta `showPage`. Hoy son **24** y están alineadas.
> Si agregas/quitas un módulo, actualiza **los tres** lugares en el mismo cambio.

### Módulos canónicos (24)
`home`, `agregar`, `inventario` (Almacén), `distribuidores`, `produccion-interna`,
`disponibilidad`, `salida`, `asistencia`, `procedimientos`, `clientes-puntos`,
`historial-produccion`, `entradas-almacen`, `ventas`, `reporte-compras-distribuidor`,
`rnc-dgii`, `comandas`, `autorizaciones`, `historial-decomiso`, `decomiso`, `produccion`
(Departamentos A-B-C), `diagnostico`, `comandos`, `configuracion`, `entrenamientos`.

## 5. Ideología de despliegue (flujo seguro)

Definida en `scripts/deploy-safe.ps1` (lo llaman `Deploy.ps1` y `npm run deploy`):

1. **Respaldo en GitHub primero, luego Firebase.** Nunca se despliega sin respaldar.
2. **Solo desde la rama por defecto (`main`).** Si estás en otra rama, aborta.
3. Hace `git add/commit/push` y luego `firebase deploy --only hosting` (o `functions`/`all`).
4. Verifica al final que local ↔ GitHub quedaron sincronizados.

`GitHub Actions` (`.github/workflows/deploy.yml`) replica esto: push a `main` → deploy de hosting;
`workflow_dispatch` permite elegir `hosting | functions | all`.

**Cache-busting:** los `<script>`/recursos versionados usan `?v=AAAAMMDD-descripcion`. Al cambiar
`app.js`/`cloud-bridge.js`/etc., **sube el `?v=`** en `app.html` para forzar recarga.

## 6. Política de seguridad (sincronizar con la ideología)

- **Sin secretos en el cliente.** Las API keys (p. ej. Groq) y contraseñas **no** deben vivir en
  `public/` ni enviarse a terceros. Lo correcto es un **proxy en `functions/`** que guarde la clave
  como secreto del backend; el front llama a la Cloud Function, no a `api.groq.com` directo.
- `MASTER_PASS` no debe estar hardcodeado en JS de cliente ni incrustarse en el prompt del LLM.
- Acciones destructivas del asistente IA (`[LIMPIAR]`, `[ELIMINAR_*]`) deben **siempre** pasar por
  confirmación explícita.

## 7. Comandos útiles

```powershell
npm run deploy            # flujo seguro: respaldo GitHub -> Firebase hosting
npm run deploy:functions  # solo backend
npm run deploy:all        # functions + hosting
npm run deploy:analyze    # diagnóstico sin desplegar
npm start                 # firebase serve (local)
```
