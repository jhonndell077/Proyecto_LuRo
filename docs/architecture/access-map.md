# Mapa de Acceso LuRo Control

## Entrada principal

- `public/index.html`
  - Landing pública.
- `public/acceder.html`
  - Acceso de operadores y administradores.
- `public/app.html`
  - Shell operativo completo de LuRo Control.

## Estructura viva del sistema

- `public/assets/js/app.js`
  - Núcleo del sistema.
  - Contiene navegación, datos locales, reglas operativas y el Asistente LuRo.
- `public/assets/js/cloud-bridge.js`
  - Conecta el frontend con Firebase Functions.
  - Mantiene sesión cloud, presencia, lectura y escritura remota.
- `functions/index.js`
  - Backend principal de Firebase Functions.

## Accesos del Asistente LuRo

Puntos de entrada visibles en `public/app.html`:

- `#sidebar-assistant-launch`
  - Acceso desde la barra lateral.
- `#comandos-open-assistant-btn`
  - Acceso desde el módulo de comandos.
- `#luro-assistant-fab`
  - Botón flotante global.

Panel y ejecución:

- `#luro-assistant-panel`
  - Contenedor visual del asistente.
- `#luro-assistant-input`
  - Entrada principal de texto.
- `window.toggleLuroAssistant(forceOpen)`
  - Abre o cierra el asistente.
- `window.enviarMensajeAsistente()`
  - Toma el texto, lo interpreta y ejecuta la respuesta.

## Flujo de ejecución del asistente

1. El usuario abre el panel desde sidebar, comandos o FAB.
2. `abrirPanelAsistente()` prepara estado visual y foco.
3. `assistantRefs()` enlaza elementos reales del DOM.
4. `enviarMensajeAsistente()` recoge el mensaje.
5. `resolverIntencionAsistente(...)` interpreta intención, módulo y acción.
6. Si aplica, el sistema ejecuta navegación o acción real.
7. El resultado vuelve al panel y actualiza el estado del módulo de comandos.

## Acceso cloud de LuRo

`public/assets/js/cloud-bridge.js` maneja:

- `rememberCloudAuth`
  - Guarda credenciales activas para sesión cloud.
- `ensureCloudAuth`
  - Verifica si la sesión sigue disponible.
- `postCallable`
  - Llama funciones HTTPS del backend.
- `postCallableWithSession`
  - Llama funciones protegidas con credenciales activas.
- `startCloudPresenceHeartbeat`
  - Marca presencia operativa periódica.

## Regla operativa

- Si se toca `public/app.html`, revisar accesos visibles.
- Si se toca `public/assets/js/app.js`, validar el flujo del asistente.
- Si se toca `public/assets/js/cloud-bridge.js`, validar login cloud y presencia.
- Si se toca `functions/index.js`, revisar compatibilidad con frontend antes de deploy.

## Validación rápida

Ejecutar:

```powershell
npm run audit:structure
```

Si esta validación falla, no conviene desplegar sin corregir primero.
