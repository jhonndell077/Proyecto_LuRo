---
name: repositorio1-admin
description: "Skill para administrar el repositorio LuRo Control (Repositorio1): estructura canónica, despliegue seguro, nomenclatura de archivos y reglas de edición de `public/` y `functions/`."
author: GitHub Copilot
---

# Repositorio1 Admin

Usa esta skill cuando necesites administrar, auditar o proponer cambios en el proyecto `Repositorio1`.

## Ámbito

- `public/` es la fuente canónica y el único contenido que se despliega en Firebase Hosting.
- `functions/` es el backend canónico de Cloud Functions.
- Archivos en la raíz como `index.html`, `app.js`, `styles.css` y la carpeta `Repositorio1/` son copias legacy o scratch.
- `.deploy-lafocacheria/` es una publicación separada para el sitio `lafocacheria` y no debe mezclarse con el panel LuRo.
- `CLAUDE.md` define la ideología de trabajo: orden, control, rentabilidad y seguridad.

## Reglas clave

- Edita siempre en `public/` y `functions/` para cambios de producción.
- No muevas ni modifiques contenido en `NEWPROYECTO/`, `._archive/` o copias duplicadas salvo que el cambio deba aterrizar en la versión canónica primero.
- Mantén intacta la configuración de `firebase.json` y la ruta `hosting.public: "public"`.
- Usa `scripts/deploy-safe.ps1` y los scripts de `package.json` para despliegues seguros.
- Si hay solicitudes de deploy, sugiere primero revisar la rama `main`, hacer commit/push y luego desplegar.

## Qué puede hacer esta skill

- Auditar y explicar qué archivos son canónicos vs legacy.
- Sugerir rutas de corrección para cambio de código en `public/` y `functions/`.
- Recomendar acciones seguras de despliegue para Firebase Hosting y Cloud Functions.
- Detectar riesgos de edición en archivos de copia o publicaciones externas.
- Responder sobre la estructura del proyecto y el flujo de trabajo de mantenimiento.

## Instrucciones para el asistente

Responde en español, directo y sin relleno. Prioriza la seguridad y la coherencia del repositorio. Evita recomendaciones que impliquen editar archivos de respaldo, copias scratch o contenido no desplegado.

Si se trata de un cambio de interfaz, siempre menciona que la edición correcta está en `public/assets/js/` y/o `public/app.html`.

Si se trata de un despliegue, sugiere:

1. confirmar que la rama activa es `main`
2. hacer commit y push de los cambios canónicos
3. ejecutar `npm run deploy` o `npm run deploy:functions`/`npm run deploy:all`

Para cualquier cambio relacionado con Firebase, menciona que `firebase.json` usa `public` como raíz de hosting y que los archivos HTML/JS en `public/` son los que se sirven.
