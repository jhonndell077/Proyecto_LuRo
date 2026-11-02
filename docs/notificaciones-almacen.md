# Notificaciones persistentes de Almacén

La campana del marco superior abre un panel con Almacén y Pedidos y tareas. Se conserva el marco de cuatro controles y el funcionamiento del asistente. Los avisos son internos de LuRo; no se solicitan permisos de notificaciones del dispositivo ni se envían correos o mensajes.

## Comportamiento

- Reposiciones pendientes muestra los productos cuya existencia está por debajo de la meta del período activo, con la cantidad necesaria y un botón para abrir el producto en Almacén.
- El historial conserva movimientos con saldo anterior/nuevo, unidad y fecha. Se genera un aviso de reposición al entrar en faltante, sin repetirlo por cada guardado mientras continúe bajo meta. Un nuevo ciclo de reposición vuelve a avisar.
- El contador muestra avisos no leídos de la cuenta, módulo y período activos. Marcar como leído no elimina la reposición pendiente. Se conservan los últimos 200 avisos por propietario/módulo.
- Los datos se guardan en inventoryNotifications y inventoryNotificationState, dentro de la base local y el puente cloud existente. Se detectan cambios al guardar entradas, recuentos, producción, salidas/importaciones y al aplicar datos sincronizados. Las modificaciones remotas se observan al recibir la sincronización; no se añadió un proceso de seguimiento con la aplicación cerrada.
- Al instalar la función, el stock existente se toma como referencia sin crear movimientos ficticios. Los faltantes existentes sí generan avisos iniciales. La observación se prepara al cargar la base para captar también la primera operación.
- La combinación con la nube conserva lecturas e historial sin duplicar el mismo cambio. Los avisos creados al recibir cambios remotos se programan para subir como metadatos locales. Los fallos de almacenamiento no dejan movimientos de operaciones revertidas, y los avisos pendientes de guardar se reintentan.

## Validación

Pruebas locales de línea base, movimientos sucesivos, ciclos de reposición, períodos, aislamiento por propietario/módulo/permisos, retención, lectura persistente, fusión cloud, recarga, actualización desde nube y errores de almacenamiento. Pruebas de navegador entre 320 y 1440 px y regresiones de controles, importación PDF/Excel, inventario, producción, pedidos y menú. Sin consultas o modificaciones de datos de producción durante las pruebas.
