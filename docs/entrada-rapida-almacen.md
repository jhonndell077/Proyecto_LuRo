# Entrada rápida al almacén

En Almacén, «Registrar entrada» abre un formulario de producto existente y cantidad recibida, tomando como referencia la captura facilitada del Gestor. Las opciones pertenecen únicamente al propietario y módulo activos de LuRo. La cantidad se expresa en la unidad del producto y se suma a su existencia; se conservan costo unitario, proveedor y metas. Las compras con precios nuevos y el alta de productos siguen disponibles en «Entrada avanzada / Nuevo producto».

Cada entrada pasa por guardarDatos y su sincronización habitual, incorpora registro en db.entradas con operador, saldo anterior y posterior, y activa el observador existente de notificaciones. Si falla la persistencia local se revierten saldo e historial. Se conservan las restricciones actuales: colaboradores solo lectura y asignación manual obligatoria.

No hay conexión de datos con el sitio externo: https://gestor-jssan.web.app devolvió Firebase «Site Not Found» durante la implementación. Este formulario opera sobre el almacén canónico de LuRo, sin importar ni duplicar inventarios externos.

Validación local: node --test --test-concurrency=1 scripts/test-warehouse-entry.cjs scripts/test-inventory-workspace.cjs scripts/test-inventory-notifications.cjs scripts/test-inventory-notifications-domain.cjs scripts/test-inventory-domain.cjs (14 pruebas). Incluye persistencia, historial, avisos, permisos, aislamiento de módulos, errores de guardado y anchos de 320 a 1440 px. npm run audit:structure y comprobaciones sintácticas completadas. No hay scripts build, types ni lint en package.json; no se añadieron herramientas ni se probaron servicios productivos.
