# Estructura de Repositorio1

## Núcleo LuRo Control

- `public/index.html`
  - Landing pública del producto LuRo Control.
- `public/acceder.html`
  - Entrada de autenticación previa al panel.
- `public/app.html`
  - Shell principal del sistema operativo interno.
- `public/assets/js/app.js`
  - Motor principal del frontend: módulos, datos locales, asistente, reglas de negocio y navegación.
- `public/assets/js/cloud-bridge.js`
  - Sincronización con backend y Firebase Cloud Functions.
- `public/assets/js/asistencia-module.js`
  - Lógica aislada del módulo de asistencia.
- `public/assets/css/styles.css`
  - Estilos base del sistema LuRo.

## Módulo La Foca Cheria

- `public/velvet-site/`
  - Sitio público del restaurante.
- `public/velvet-admin/`
  - Panel administrativo del sitio público.
- `.deploy-lafocacheria/`
  - Carpeta de publicación separada usada para deploy del sitio La Foca Cheria.

## Backend

- `functions/index.js`
  - Backend de Firebase Functions.
- `functions/whatsapp-notifications.js`
  - Apoyo a notificaciones y mensajería.

## Configuración y despliegue

- `firebase.json`
  - Hosting principal y source de functions.
- `.firebaserc`
  - Asociación de proyectos Firebase.
- `Deploy.ps1`
  - Flujo de despliegue manual del repo.
- `scripts/deploy-safe.ps1`
  - Variante segura de despliegue.

## Históricos y soporte

- `docs/`
  - Documentación viva del proyecto.
- `_archive/`
  - Copias y material viejo. No debe usarse como fuente activa.
- `media/`
  - Recursos gráficos y multimedia.

## Regla práctica de operación

- La app viva de LuRo sale desde `public/`.
- El backend vivo sale desde `functions/`.
- La Foca Cheria se edita en `public/velvet-site` y `public/velvet-admin`, pero se publica desde `.deploy-lafocacheria/`.

## Validación recomendada antes de deploy

- Ejecutar `npm run audit:structure`.
- Revisar `docs/architecture/luro-assistant.md`.
- Revisar `docs/architecture/access-map.md`.
