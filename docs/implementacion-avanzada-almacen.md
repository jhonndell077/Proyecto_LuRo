# Implementación avanzada de Almacén

Adaptación de los flujos de Inventario y Listado de Compra de https://gestor-js.web.app/ a las existencias canónicas de LuRo. No se copian cuentas ni configuraciones de autenticación del sitio de referencia.

## Inventario

- Inventario tabular con código, categoría, proveedor, unidad, existencia, meta por período, faltante y costo unitario.
- Metas independientes lunes-jueves y viernes-domingo. Los productos anteriores usan su existencia ideal para ambos períodos hasta configurar metas propias. Cero es una meta válida.
- Filtros por producto/código/proveedor/categoría y por faltantes; exportación CSV de todos los productos del módulo.
- Edición de códigos, categorías, proveedor, costo, metas y producto preparado vinculado. La identidad del producto y su unidad se conservan para mantener recetas y movimientos.
- Recuento físico absoluto con diferencias registradas en inventoryRecounts y visualización de los últimos 30 registros del módulo. No representa una compra ni un decomiso.

## Lista de compra

- Generación para el período seleccionado. Compra = máximo(meta − existencia, 0).
- Si la existencia preparada del mismo producto o del vínculo configurado cubre por completo el faltante, se marca cubierto y la compra es 0; las unidades deben ser compatibles. Una producción compartida por varios alias no se cuenta varias veces.
- Usa Almacén y Producción del mismo propietario y módulo. Las áreas como Cuarto Frío pueden identificarse por categoría en el almacén de LuRo; no se crea una base de inventario separada.
- Lista con proveedor, unidad, meta, existencia, cantidad, estado y estimado. Filtro, exportación CSV e impresión/PDF mediante el diálogo del navegador. Generar, exportar o imprimir no altera existencias ni envía mensajes.

## Migración masiva

- Excel con selector de hoja; CSV/TSV y enlaces públicos. Conserva selección de encabezados y vista previa.
- Reconoce códigos, categorías, proveedores, unidad, costo, ambas metas y vínculo de producción. Incluye nombres de columnas del modelo de referencia: CodArticulo, Stock L-J, Stock V-D, Medida, Suplidor y Existencia.
- Sumar entradas conserva el cálculo de costo promedio. Migrar saldos establece cantidades/costos para los productos coincidentes, conserva productos ausentes en la hoja y registra ajustes por migración. Repetir una migración idéntica no suma existencias ni duplica ajustes. Los duplicados ambiguos, códigos repetidos y unidades incompatibles se rechazan antes de modificar datos.
- Los PDF requieren conversión previa a Excel o CSV. No se añadieron dependencias, permisos de Google ni envío de correo. La sincronización usa el puente cloud existente.

## Verificación

Pruebas con fixtures locales: metas por período, unidades y cobertura preparada, aislamiento de cuentas/módulos, códigos duplicados, recuentos, migración repetida, Excel con varias hojas, formatos de referencia, importación, producción, disponibilidad, pedidos y menú. Se revisaron sintaxis, diff, estructura y vistas entre 320 y 1440 píxeles. No hay scripts de build o tipos en este proyecto.

## Ajuste de legibilidad y período de stock

La tabla muestra primero Producto, Existencia y Faltante, con unidades y texto legible. Código, categoría, proveedor, meta, costo y acciones están en Detalles por producto. Las tres columnas caben sin desplazamiento horizontal entre 320 y 1440 px.

El período se elige con dos botones visibles (lunes-jueves y viernes-domingo), con indicación del seleccionado. La preferencia se conserva localmente por propietario y módulo. Cambiar de período actualiza los faltantes y regenera una lista de compra que ya estuviera generada, sin modificar existencias ni metas. Pruebas de edición/recuento, navegación, persistencia del período, importación y operaciones completadas, más auditoría de estructura y sintaxis.
