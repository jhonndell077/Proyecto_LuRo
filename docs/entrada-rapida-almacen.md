# Entrada rápida al almacén

En Almacén, «Registrar entrada» abre un formulario de producto existente y cantidad recibida, tomando como referencia la captura facilitada del Gestor. Las opciones pertenecen únicamente al propietario y módulo activos de LuRo. La unidad de entrada es seleccionable entre las compatibles con el producto (peso, volumen o unidades). La cantidad se convierte a la unidad del almacén y se suma a su existencia; se conservan costo unitario, proveedor y metas. Las compras con precios nuevos y el alta de productos siguen disponibles en «Entrada avanzada / Nuevo producto».

El historial conserva la cantidad y unidad recibidas junto con la cantidad convertida y unidad del almacén. Por ejemplo, 500 g suman 0.5 Kg a un producto almacenado en Kg. Se rechazan unidades incompatibles antes de cambiar existencias.

Cada entrada pasa por guardarDatos y su sincronización habitual, incorpora registro en db.entradas con operador, saldo anterior y posterior, y activa el observador existente de notificaciones. Si falla la persistencia local se revierten saldo e historial. Se conservan las restricciones actuales: colaboradores solo lectura y asignación manual obligatoria.

No hay conexión de datos con el sitio externo: https://gestor-jssan.web.app devolvió Firebase «Site Not Found» durante la implementación. Este formulario opera sobre el almacén canónico de LuRo, sin importar ni duplicar inventarios externos.

Validación local: node --test --test-concurrency=1 scripts/test-warehouse-entry.cjs scripts/test-inventory-workspace.cjs scripts/test-inventory-notifications.cjs scripts/test-inventory-notifications-domain.cjs scripts/test-inventory-domain.cjs (14 pruebas). Incluye persistencia, historial, avisos, permisos, aislamiento de módulos, errores de guardado y anchos de 320 a 1440 px. npm run audit:structure y comprobaciones sintácticas completadas. No hay scripts build, types ni lint en package.json; no se añadieron herramientas ni se probaron servicios productivos.
