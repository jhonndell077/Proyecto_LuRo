# Integración 2.0: implementación local

Referencia: PDF `Integracion2.0.pdf` suministrado por el usuario. Cambios del 31 de octubre de 2026 en `public/` y `functions/`.

| Diagrama | Comportamiento implementado |
| --- | --- |
| Envío a caja | Confirmación «Su pedido fue dirigido a caja perfectamente», indicador circular mientras está pendiente e indicador de carga durante el envío. |
| Fin de cocina | Se conserva el flujo existente: archivar comanda, quitarla de activas y mostrar «Tu pedido está listo». |
| Perfil público | Botón «Quiero ser Miembro», formulario de nombre, cédula y teléfono, perfil automático y enlace privado de 30 días. |
| Frase sin registrar | Inicio muestra «Pendiente por incluir»; consultar el catálogo genera una única tarea por módulo. Frase editable en Configuración. |
| Tareas Pendientes | Nuevo módulo, enlace en navegación y acceso desde ambos asistentes LuRo. Lista solicitudes de membresía y contenido pendiente. |
| Notificaciones flotantes | Aviso global de pedidos pendientes y tareas para administradores; caja ve pedidos según sus permisos. Persiste al navegar y se recupera al consultar el servidor. |
| Respuesta visual | Indicadores `aria-busy`, bloqueo de duplicados en operaciones y animación circular; respeta movimiento reducido. |
| Edgar → Lafo | Contexto público derivado del catálogo, recetas, disponibilidad y ventas del propietario/módulo; pedidos de la sesión y puntos del perfil privado. |
| Más vendido | Ranking de cantidades realmente registradas en ventas; no inventa popularidad cuando falta historial. |
| Composición | Nombres de ingredientes; excluye cantidades, costos, pasos y receta completa. |

Edgar se implementa como puente determinista de datos (`LuRoEdgar`), sin un servicio de IA adicional. Lafo recibe exclusivamente información necesaria para el cliente; los módulos administrativos no se exponen completos al navegador público. Las conexiones existentes de menú y comandas se conservan.

## Membresía y privacidad

El perfil nuevo funciona inmediatamente y recibe un enlace privado en pantalla, sin crear cuentas de Firebase Auth. Una cédula declarada no otorga acceso a puntos ni compras de un cliente existente. Se genera una tarea para el administrador: verificar la identidad, registrar al cliente en Clientes y puntos si aún no existe y seleccionar ese registro. El servidor exige coincidencia de cédula antes de vincularlo. No se activa una suscripción de pago automáticamente ni se envían SMS o correos.

Las altas son idempotentes por sesión y módulo, con un límite de diez nuevas altas por minuto por negocio/módulo. Las colecciones `menu_members/{scope}/members` y `menu_tasks/{scope}/tasks` se consultan mediante el backend. Se conservan las reglas actuales de denegación por defecto.

Nuevas funciones exportadas mediante el registro existente: `menuRegisterMember`, `menuListTasks`, `menuResolveTask`. El puente administrativo permite las dos últimas únicamente mediante la sesión existente. Las tareas de contenido se pueden completar después de sincronizar la frase. Si vuelve a faltar la frase, se reabre la tarea.

Los avisos dependen de la app abierta y de la consulta periódica de 12 segundos. No hay push con el navegador cerrado. El enlace de miembro se entrega en pantalla para guardarlo y se conserva en sessionStorage al usarlo.

## Verificación ECC verification-loop

- Sintaxis: validada en los JavaScript modificados. El proyecto no define build ni verificación TypeScript.
- Lint existente y auditoría de estructura: aprobados.
- 35 pruebas de integración, DOM y Chrome: aprobadas.
- 2 pruebas Chrome adicionales de arranque móvil y diseño adaptable: aprobadas; 25 secciones revisadas.
- Revisión manual del diff: conserva cambios previos ajenos; sin cambios a reglas, configuración Firebase, secretos o despliegues.
- Revisión de privacidad: aislamiento de propietario/módulo y sesión, perfil sin documento/teléfono, coincidencia de cédula para vinculación, recetas sin cantidades y tareas administrativas autenticadas.
- Cobertura porcentual: no medida.

```powershell
node --test --test-timeout=60000 functions/tests/menu-integration.test.cjs scripts/test-menu-frontend.cjs scripts/test-menu-admin.cjs scripts/test-integration2-browser.cjs scripts/test-module-startup.cjs scripts/test-responsive.cjs
npm --prefix functions run lint
npm run audit:structure
```

Todas las pruebas utilizan fixtures locales y bloquean llamadas externas en Chrome. No se instalaron dependencias ni se probaron datos de producción. Esta implementación está local y requiere publicación de Hosting y las funciones correspondientes para aparecer en el sitio público. No se ha publicado.
