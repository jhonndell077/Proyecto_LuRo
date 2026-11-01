# Cambios solicitados en Luro3.3.pdf

Implementación local, sin despliegue ni modificaciones de datos en producción.

- Almacén: botón Importar, lectura local de Excel .xlsx y CSV/TSV, importación por enlace HTTPS de Google Sheets y plantilla CSV descargable. Selección de columnas; la primera hoja del Excel se utiliza como origen. Los enlaces requieren que la hoja permita lectura sin autenticación. Los archivos .xls deben convertirse a .xlsx o CSV.
- Los costos vacíos se importan como 0. Sin cantidad se registra un producto con existencia 0. Las cantidades se suman a las existencias de la cuenta y módulo activos y se calcula el costo promedio ponderado. Se validan todas las filas antes de modificar los datos. La cantidad ideal se interpreta en la unidad indicada por la hoja.
- Entrada manual: costo unitario por cantidad calcula el total. Se mantiene la entrada por costo total y la sugerencia de precios del catálogo; el precio manual tiene prioridad.
- Registrar salida: muestra únicamente solicitudes pendientes. Aceptar retira inmediatamente la solicitud de esa lista; los controles de preparación y entrega quedan en Comandas.
- Agregar Plato queda debajo de Clientes y Puntos.

## Diferencia con el borrado literal solicitado

Se conserva el registro canónico del pedido en backend para que cocina, mesas, cobro, reservas de stock y seguimiento del cliente continúen funcionando. Se elimina de la lista de aceptación, pero no se borra físicamente el pedido ni su historial. No se modificaron reglas, secretos, configuración Firebase ni datos remotos.

## Hoja de ejemplo

El enlace del PDF no pudo leerse en esta sesión. No se precargaron sus productos ni se verificó su estructura real. El importador permite cargar el archivo o leer el enlace cuando esté compartido para lectura y seleccionar las columnas correspondientes.

## Verificación local

Pruebas con datos locales: Excel comprimido y sharedStrings, CSV, costo vacío, productos con acentos, suma y costo ponderado, aislamiento de cuentas/módulos, rechazo de unidades incompatibles sin cambios parciales, costo manual, navegación y ventanas entre 320 y 1440 px. Regresiones de inventario, producción, pedidos y administración de menú. Auditoría de estructura, sintaxis JavaScript y revisión del diff. El proyecto no define scripts de build, tipos o lint frontend; no se instalaron herramientas ni dependencias.

## Corrección de lectura de inventarios compartidos

- Si Google rechaza la exportación CSV, se intenta leer la tabla pública del editor. No se envían credenciales del usuario ni se modifica la hoja.
- Detección automática y selección manual de la fila de encabezados. Reconoce PRODUCTOS, MEDIDA, ALMACEN y Stock ideal (provisional). Vista previa antes de confirmar; los nombres repetidos con unidades incompatibles reciben la unidad como sufijo visible.
- El selector deja visibles todos los archivos y explica cómo convertir PDF y formatos no compatibles. No se añadió un lector PDF al navegador ni se instalaron dependencias.
- Se comprobó la lectura del enlace aportado desde un navegador con la app local interceptada: 92 productos y encabezados en fila 3. Los datos del PDF se convirtieron a CSV para entregar por separado; no se incluyen en los archivos públicos ni se importan automáticamente en ninguna cuenta.
- Pruebas locales de lectura CSV/Excel, respuestas 400 y errores de red, tabla HTML pública, encabezados desplazados, duplicados con distintas unidades, vista previa y explicación de PDF. Regresiones del menú y dominio de stock, auditoría de estructura y sintaxis JavaScript.
