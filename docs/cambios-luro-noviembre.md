# Cambios de LURO — noviembre de 2026

Referencia: «LURO cambios.pdf». Implementación local, pendiente de despliegue.

## Cambios

- Marco superior común para menú, alertas, asistente y Mesas. Los tres controles originales comparten tamaño, fondo y bordes.
- Mesas abre las cuentas activas del módulo. El aviso persiste hasta cerrar las cuentas; las mesas unidas se cuentan una sola vez. El acceso respeta el permiso de Salida.
- Almacén muestra una tira compacta de indicadores y el inventario. Registro de entrada y herramientas permanecen en el mismo módulo mediante desplegables.
- Distribuidores y ajuste masivo de precios tienen formularios compactos y desplegables. Editar un distribuidor abre su formulario.
- Se retira Añadir Directamente de Disponibilidad.
- La edición de existencia del plato valida cantidades enteras, cero o positivas, e impide superar la capacidad real de sus insumos. Se agrupan ingredientes repetidos, se convierten unidades compatibles y se consultan insumos del propietario y módulo correspondientes. Una producción disponible puede respaldar el plato cuando el ingrediente de almacén no tiene existencia.
- Comandas muestra únicamente las comandas actuales. El listado general de pedidos de la app permanece en Caja; se retira el botón/modal de historial de Comandas. Se conservan los registros anteriores para auditoría.
- Se mantienen la tarjeta virtual y el acceso a Administración sin contraseña adicional, implementados en la entrega anterior.

## Producción

Se consultó la copia local `C:/Users/USER/Desktop/Proyectos_Desplegados/Gestor/public/index.html`, componente `ProduccionPage`. La adaptación usa los inventarios, permisos y sincronización existentes de LURO.

Funciones implementadas:

- Recetas guardadas, búsqueda, edición, eliminación y recetario imprimible.
- Recetas anteriores de inventario accesibles desde el nuevo recetario. Cuando el registro antiguo no indica el rendimiento original, el operador debe indicarlo antes de programar el lote.
- Producción por lotes con multiplicador, insumos de almacén o semielaborados, procedimientos ordenables e instrucciones.
- Producción pendiente con fecha y cantidad; completar el lote actualiza su estado.
- Producciones en espera que se pueden retomar o cancelar, sin consumir insumos antes de completar.
- Vista previa de rendimiento y costo; validación completa antes de descontar el primer insumo, incluyendo filas repetidas, unidades incompatibles y cantidades inválidas.
- Merma prevista y real, costo medio ponderado e historial de insumos consumidos.
- Carga de producción ya realizada con costo declarado, sin volver a descontar materia prima.
- Transferencia de semielaborados a otros módulos del mismo propietario, conservando cantidad y costo.
- Reversión de lotes nuevos cuando hay suficiente producto para retirarlo y los insumos todavía existen. Se devuelve materia prima y se marca la reversión, sin borrar la trazabilidad.

Los destinos y fuentes se corresponden con el modelo de LURO. No se conectan bases de Gestor ni se importan sus credenciales o permisos. Sus conversiones particulares por empaque y almacenes especiales requieren equivalencias explícitas antes de incorporarlas; las unidades incompatibles se rechazan.

Los campos nuevos `productionRecipes`, `productionHolds` y `productionSchedule` se serializan con la base canónica por propietario. El backend reconoce que una base con estos registros tiene contenido, para no tratarla como vacía.

## Verificación

- 55 pruebas locales aprobadas: backend del menú, administración, tarjeta y asistente públicos, arranque, reglas de stock, flujos de producción, Mesas y navegación.
- 25 secciones revisadas a 320, 390, 768, 1024 y 1440 píxeles. Las tablas conservan desplazamiento horizontal dentro de su contenedor.
- Formulario de producción revisado a cuatro anchos, con capturas en `tmp/operations/`.
- Validación de estructura y comprobación de sintaxis de JavaScript aprobadas. Sin scripts de build, TypeScript o lint frontend definidos por el proyecto.
- Se corrigió la sintaxis del service worker y se versionaron los recursos nuevos para actualización de la app instalada.
- Verificación con fixtures y sin solicitudes a servicios de producción. No se modificaron reglas, secretos, cuentas ni configuración Firebase; no se instalaron dependencias.
