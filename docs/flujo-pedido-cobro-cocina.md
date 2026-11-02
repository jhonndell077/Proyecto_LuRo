# Pedidos web: revisión, cobro y envío a cocina

Orden acordado: cliente envía → caja revisa → caja cobra y cierra cuenta → caja acepta y envía a cocina → cocina comienza → cocina marca listo → personal entrega.

Revisar pedido cambia pending a reviewed y crea una cuenta de caja con sus consumos, persona y datos mínimos del cliente. No crea comanda. Cobrar abre el pago total de la cuenta existente. Confirmar pago y cerrar cuenta ejecuta el registro de venta y la factura del POS; si la venta se cancela o falla, se revierten las marcas de pago de las personas. La sincronización habitual concilia las ventas con el pedido, marca paid y libera las reservas una sola vez. Hasta la confirmación remota no se muestra Aceptar y enviar a cocina.

Enviar a cocina requiere reviewed y pago confirmado en el servidor. Crea una comanda por pedido, conservando productos y notas aunque la cuenta ya se haya cerrado; reintentar no duplica comandas. La aceptación no vuelve a crear consumos ni ventas. Después siguen accepted → preparing → ready → delivered. Rechazar un pedido reviewed sin pagar libera su cuenta y reservas; un pedido cobrado no se rechaza mediante este botón. Las devoluciones requieren gestión separada. Los pedidos anteriores ya aceptados conservan su flujo de cocina existente.

Los controles de revisión y cobro solo se presentan a caja/administración, y el servidor exige permisos de salida para revisar, aceptar o rechazar. El cobro registra el método recibido por el cajero; no procesa pagos bancarios ni tarjetas desde el navegador.

Pruebas: 43 casos locales del servidor, cliente, administración, controles flotantes y Chrome. Incluyen bloqueo de envío sin pago, revisión sin comanda, cancelación/rechazo, idempotencia, cuenta cobrada y cerrada con una venta y un descuento de stock, y continuidad hasta entrega. Las pruebas usan fixtures y bloquean llamadas externas. Sintaxis JS, lint de funciones y estructura del proyecto comprobados. No hay scripts de compilación o tipos de frontend; no se instalaron dependencias. No se crearon pedidos ni cobros en producción.

Publicación selectiva: Hosting y funciones menuUpdateOrder, menuGetOrders, menuListOrders, upsertOwnerData; sin reglas, secretos ni configuración Firebase modificados.
