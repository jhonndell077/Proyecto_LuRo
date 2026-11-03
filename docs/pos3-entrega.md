# Entrega incremental del motor POS 3 — 3 de noviembre de 2026

## Alcance implementado

Se amplía LuRo Control; no se crea otra base de inventario ni otro catálogo. `functions/pos-operations.js` ejecuta transacciones sobre `datos_del_propietario/{owner}` y las colecciones existentes `menu_orders` y `menu_reservations`. `functions/pos-domain.js` valida operaciones, reservas de platos e insumos, renglones estables, entregas parciales, cobros parciales, devoluciones monetarias y movimientos compensatorios. Las claves de operación vinculan negocio, módulo y actor; repetir una clave con otros argumentos se rechaza.

El flujo por defecto es: confirmar pedido → revisión de caja → pago confirmado → aceptar y enviar a cocina → comenzar preparación → marcar listo → entregar. El pago no descuenta inventario. Cada entrega descuenta exclusivamente sus unidades y sus recursos reservados. Los productos preparados por lote consumen producto terminado; no vuelven a consumir los ingredientes ya utilizados en producción. Registrar Salida conserva su funcionamiento tradicional en módulos aún no activados; en módulos activados dirige las operaciones al mismo motor.

`public/assets/js/pos-workspace.js` añade acceso Operación POS junto a Almacén, reutiliza las sesiones existentes y permite consultar pedidos, cobrar, registrar entregas y movimientos. `pos-compatibility.js` dirige las escrituras antiguas al motor. `pos-legacy-guard.js` impide que una pestaña antigua sustituya los dominios gestionados con una subida de base obsoleta. Después de un cambio confirmado se descarga la base para las vistas originales. Un borrador detiene el refresco de formularios; una respuesta ambigua conserva la clave de reintento. Sin conexión no se confirman operaciones.

The Proyect envía los pedidos de los módulos activados al mismo servicio, conserva su sesión opaca y solo recibe una proyección pública del pedido. Lafo consulta el catálogo real, añade productos solicitados al carrito y exige la confirmación del formulario para enviar. Ninguna operación esencial requiere IA de pago.

## Activación controlada

Publicar no activa ni migra los módulos existentes. El administrador abre Operación POS y solicita Activar motor en este módulo. El servidor exige cerrar pedidos, cuentas y comandas previos y crea un respaldo íntegro del payload anterior en `datos_del_propietario/{owner}/pos_backups/{id}` dentro de la misma transacción. Ante una base demasiado grande se detiene sin cambios. El respaldo de código local y los escenarios sintéticos no equivalen a un respaldo verificado de todos los datos productivos.

Las reglas, credenciales, cuentas de Authentication y configuración de Firebase no se modifican en esta entrega. Las entradas, recuentos, decomisos y devoluciones requieren administración; producción usa el permiso existente `produccion-interna`, caja `salida` y cocina `comandas`. El permiso histórico de lectura de inventario no concede escritura.

## Validación

Pruebas de dominio, compatibilidad, frontend y emulador incluidas en el repositorio. `tests/pos3/run-emulator.ps1` usa únicamente `demo-luro-pos3` y datos sintéticos: nueve pechugas, entregas de cuatro y cinco, reconexión sin doble descuento, pago repetido sin duplicación, competencia por la última porción, aislamiento y permisos. También verifica el adaptador público real menuSubmitOrder → motor y que no exponga recetas o reservas internas. No se generan pedidos ni pagos de prueba en producción.

## Límites y trabajo pendiente

Esta entrega no equivale a completar toda la arquitectura POS 3.0: siguen pendientes salones configurables, sesiones de mesa, unión/separación y traslado de cuentas, cierres de caja, facturación fiscal, renovación integral de Authentication/roles, herramientas administrativas de agentes y un respaldo/restauración completos de producción. Las veinte mesas mostradas son la configuración heredada; no constituyen un nuevo gestor de salones. Las devoluciones monetarias no reponen alimentos ni implementan devoluciones físicas.

Gestor WTF requiere identificar y validar su contrato, repositorio y autoridad de inventario antes de conectar escrituras. No se inventa esa integración. La disponibilidad depende de las recetas y fuentes registradas; inconsistencias existentes bloquean la operación y necesitan conciliación, no correcciones automáticas. La base monolítica conserva sus límites de tamaño y contención: el motor rechaza operaciones que superen el umbral seguro, sin perder datos.

## Publicación y reversión

Desplegar únicamente el commit revisado desde una copia limpia, preservando cambios ajenos. Publicar primero las funciones relacionadas y después Hosting; no publicar reglas ni cambiar secretos. Antes de activar módulos puede revertirse al commit anterior. Después de activarlos no debe restaurarse código antiguo que ignore las reservas: detener nuevas operaciones, conservar el motor y conciliar pedidos/pagos antes de cualquier restauración autorizada. Nunca sobrescribir la base con un respaldo antiguo sin reconciliar movimientos posteriores.
