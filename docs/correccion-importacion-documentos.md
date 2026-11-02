# Corrección de importación PDF, Excel y enlaces

## Resultado

- Lectura directa de PDF con texto seleccionable mediante PDF.js, con límites de tamaño, páginas y cantidad de productos. Reconoce tablas con columnas Producto, Medida, Almacén, Stock ideal, Precio y Proveedor. La tabla se reconstruye por coordenadas y filas; si alguna página de un PDF multipágina no se reconoce, se rechaza para evitar importaciones parciales. No incluye OCR para escaneos.
- Excel .xlsx y .xls mediante SheetJS local, incluida selección de hoja y encabezados. No depende de DecompressionStream, que podía impedir la lectura en algunos navegadores. Conserva límites de tamaño y descompresión.
- Enlaces: exportación CSV, alternativa de tabla pública y respaldo mediante inventoryReadSheet cuando falla la conexión directa del navegador. El endpoint requiere sesión activa de administrador; las peticiones a Google no incluyen credenciales del usuario. Solo se permiten URLs construidas para Google Sheets y redirecciones a hosts de exportación de Google, con límites de tiempo y tamaño. No modifica documentos ni permisos.
- Avisos de carga/error al inicio del diálogo, columnas opcionales plegadas y botón con cantidad de productos reconocidos. Se conserva la vista previa y los modos de entrada/migración.

## Validación

Se probó el PDF adjunto Inventario General2.1.pdf: 92 productos, unidades y metas reconocidas, costos y saldos vacíos tratados como 0. Se realizó el flujo hasta importar en una base fixture local. El archivo no se agregó al repositorio ni se subió a producción.

Se comprobó lectura del enlace aportado con app local interceptada: 92 productos y encabezados en fila 3. Se probaron XLSX y XLS, varias hojas, navegador sin DecompressionStream y sin AbortSignal.timeout, errores de conexión, respaldo autenticado simulado, permisos y rechazo de redirecciones ajenas a Google. No se prueban cuentas o datos de producción.

Las nuevas dependencias fueron autorizadas explícitamente por el usuario. PDF.js tiene versión exacta en package.json; las distribuciones servidas por Hosting incluyen licencias y versiones en public/assets/vendor/README.md. No se añadieron secretos ni cambios de reglas Firebase.
