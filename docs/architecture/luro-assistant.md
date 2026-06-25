# Asistente LuRo

## Dónde vive

- UI del asistente: `public/app.html`
- Motor del asistente: `public/assets/js/app.js`

## Cómo se abre

El asistente tiene tres puntos de entrada visibles:

- Sidebar:
  - `#sidebar-assistant-launch`
- Botón dentro del módulo de comandos:
  - `#comandos-open-assistant-btn`
- FAB flotante:
  - `#luro-assistant-fab`

Todos llaman a `toggleLuroAssistant(...)`.

## Cómo se ejecuta

Flujo principal:

1. `toggleLuroAssistant(true|false)` abre o cierra el panel.
2. `abrirPanelAsistente()` prepara estado visual, foco y mensaje inicial.
3. `assistantRefs()` enlaza DOM con panel, input, mensajes y sugerencias.
4. `enviarMensajeAsistente()` procesa el texto del usuario.
5. El motor clasifica intención, resuelve módulos, acciones y consultas del sistema.
6. Si aplica, ejecuta navegación real con `showPage(...)` o acciones seguras del sistema.

## Qué valida el asistente

- Navegación entre módulos
- Acciones directas del sistema
- Consultas de ventas, almacén, producción, disponibilidad y otros módulos
- Estado contextual por usuario, owner y módulo activo

## Qué depende del asistente

- `ASSISTANT_PAGES`
  - Catálogo de módulos navegables
- `ASSISTANT_ACTIONS`
  - Acciones operativas globales
- `ASSISTANT_MODULE_GUIDES`
  - Explicaciones del sistema por módulo
- `ASSISTANT_COMMAND_LIBRARY`
  - Biblioteca de comandos expuestos al usuario

## Validación rápida

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-structure.ps1
```

Si falla alguno de estos puntos, el asistente puede perder apertura visual, navegación o ejecución de mensajes.
