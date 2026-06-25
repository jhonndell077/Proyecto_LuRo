---
name: repositorio1-assistant-sync
description: "Skill para mantener sincronizados los asistentes de LuRo, los prompts IA y los módulos canónicos entre `public/assets/js/app.js` y `public/app.html`."
author: GitHub Copilot
---

# Repositorio1 Asistente IA

Usa esta skill cuando necesites trabajar con el asistente LuRo, la sincronización de módulos o la seguridad de la conversación IA.

## Ámbito

- El sistema tiene dos asistentes:
  - `public/assets/js/app.js`: Centro de comandos determinista local.
  - `public/app.html`: asistente IA por voz que usa Groq/Gemini/OpenRouter.
- El contenido desplegado es canónico solo en `public/`.
- La configuración de seguridad debe evitar claves en el cliente; las llamadas a proveedores deben pasar por backend seguro cuando sea posible.

## Sincronización crítica

- Mantén la lista de módulos de `ASSISTANT_PAGES` en `public/assets/js/app.js` alineada con los tags `[NAV:id]` y `showPage(pageId)` en `public/app.html`.
- Si agregas/quitas un módulo, actualiza:
  - `ASSISTANT_PAGES` en `app.js`
  - la lista de navegaciones en el prompt IA de `app.html`
  - las secciones reales aceptadas por `showPage`
- Revisa que no haya `MASTER_PASS` hardcodeado en el frontend ni prompts que expongan secretos.

## Reglas clave

- Las acciones destructivas del IA deben exigir confirmación.
- El asistente IA debe devolver tags claros como `[NAV:id]`, `[MODULO:NOMBRE]`, `[CLIENTE_NUEVO:...]`, `[LIMPIAR:...]`.
- El sistema prompt base en `public/app.html` y en `functions/index.js` debe permanecer coherente con la identidad de LuRo Control.

## Qué puede hacer esta skill

- Explicar cómo añadir o quitar un módulo del asistente.
- Auditar prompts y reglas de navegación entre el asistente determinista y el asistente IA.
- Sugerir mejoras seguras para la integración de Groq/Gemini/OpenRouter.
- Verificar que los cambios en los prompts no rompan las etiquetas de acción esperadas.

## Instrucciones para el asistente

Responde en español, directo y enfocado en la operación real del negocio. Evita proponer soluciones que dependan de cambiar archivos legacy fuera de `public/`.

Cuando el usuario pregunte por acciones IA, prioriza:

- revisar la lista de módulos canónicos
- validar la coherencia de prompts y tags de salida
- asegurarte de que las funcionalidades destructivas vayan acompañadas de confirmación explícita
- indicar que `public/app.html` y `public/assets/js/app.js` son los puntos de autoridad
