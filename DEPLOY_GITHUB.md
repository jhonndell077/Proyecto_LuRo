# Deploy por solicitud desde GitHub

Este repositorio permite lanzar deploy sin consola local, útil para solicitar despliegues desde móvil (GitHub app / navegador).

## Formas de pedir deploy

1. **Automático por push a `main`**
   - Cada push a `main` ejecuta deploy a Firebase Hosting.

2. **Manual (recomendado en móvil)**
   - Ir a **Actions** → **Deploy to Firebase Hosting**.
   - Pulsar **Run workflow**.
   - Completar el campo `motivo` (opcional) y ejecutar.

3. **Desde comentario en un PR**
   - Escribir un comentario que inicie con:
     ```
     /deploy
     ```
   - Al crear el comentario, se ejecuta el deploy.

## Secretos requeridos

Configurar en GitHub → **Settings** → **Secrets and variables** → **Actions**:

- `FIREBASE_SERVICE_ACCOUNT`

> El deploy usa además `GITHUB_TOKEN` generado automáticamente por Actions.
