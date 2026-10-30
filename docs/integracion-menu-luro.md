# LuRo administra The Proyect

Implementación local del diagrama «Integración LURO». El panel canónico es `public/app.html`. La app cliente está en `public/menu/`, copiada de la versión 23 del sitio existente y conectada por `luro-connection.js`. El checkout del sitio se mantiene en `.codex-temp/the-proyect-integration` hasta la publicación; no contiene cambios publicados.

## Operación

1. Iniciar sesión en LuRo como administrador y seleccionar el módulo del restaurante.
2. En **Configuración → Administración de la app del menú**, registrar nombre, logo, portada e Instagram y habilitar el menú. Guardar y sincronizar.
3. Administrar precio y existencia desde **Disponibilidad**. Editar categoría, fotografía, descripción, oferta con vencimiento, porción, nutrientes y alérgenos en la ficha del panel de menú. La app no usa los platos ilustrativos como sustituto de datos reales.
4. Abrir el enlace generado por LuRo. Incluye `owner` y `module`; no contiene credenciales administrativas. Cada negocio/módulo tiene un catálogo independiente. El enlace raíz sin estos parámetros muestra instrucciones para abrir el enlace del restaurante.
5. El cliente envía su pedido a caja. Se validan precios, cantidades y existencias en una transacción. Se reserva la cantidad solicitada y se conserva un identificador de solicitud para que un reintento no cree otro pedido.
6. Caja acepta o rechaza desde **Mesas/Salida → Pedidos de la app**. Aceptar crea una mesa libre, una persona, sus consumos y una comanda. Rechazar libera la reserva. Sin mesa libre el pedido sigue pendiente.
7. Cocina registra **Comenzar → Listo**. También puede terminar la comanda con el control existente de cocina. Al terminar, se conserva el historial y el cliente ve «Tu pedido está listo» mientras la app esté abierta.
8. El cajero usa el flujo habitual de cobro de LuRo. Una venta con el identificador del pedido, sincronizada a la nube, marca el cobro y libera su reserva. El estado de cocina es independiente del cobro. No se simula ni procesa una transferencia o pago con tarjeta en el menú.
9. Para el perfil, seleccionar un cliente de **Clientes y puntos** en la configuración del menú y generar su enlace privado. Vence a los 30 días. Se entrega únicamente al cliente; permite consultar sus puntos y compras identificadas por su documento registrado. La app recibe un resumen sin documento, teléfono, contraseñas ni datos bancarios. El token se guarda en memoria de sesión del navegador y se retira de la URL visible.

Los nutrientes se registran por porción preparada; los datos vacíos o inválidos aparecen como pendientes. No se infieren calorías desde nombres, precios o fotografías. Lafo recomienda a partir del catálogo sincronizado y sus existencias; no usa una IA externa.

## Arquitectura y permisos

`functions/menu-domain.js` contiene proyección pública, ofertas, nutrición, cotización y estados. `functions/menu-integration.js` registra las funciones callable. `functions/menu-sync.js` concilia los cobros dentro de la transacción existente de `upsertOwnerData`.

| Función | Acceso |
| --- | --- |
| `menuGetCatalog` | Público, solo negocio activo y menú habilitado |
| `menuSubmitOrder` | Sesión opaca del cliente; precio e inventario validados por servidor |
| `menuGetOrders` | Solo pedidos de la misma sesión opaca |
| `menuGetProfile` | Enlace privado aleatorio, con vencimiento |
| `menuListOrders` | Sesión LuRo de administrador o colaborador con permisos de salida/comandas |
| `menuUpdateOrder` | Sesión LuRo; aceptar/rechazar requiere caja; preparación requiere caja/cocina |
| `menuCreateCustomerLink` | Administrador LuRo |

Colecciones nuevas, accesibles exclusivamente mediante Admin SDK: `menu_orders/{scope}/orders`, `menu_reservations/{scope}` y `menu_customer_access`. `scope` es un hash del propietario y módulo. Las reglas existentes bloquean acceso directo por defecto, por lo que no se modificaron.

El catálogo proyecta únicamente campos públicos desde `datos_del_propietario`. Las reservas no se mezclan con el inventario contable. La venta habitual descuenta los insumos y productos; conciliar el cobro libera su reserva en la misma transacción que sube la venta. Se limita la recepción a tres pedidos pendientes por sesión, 60 solicitudes por minuto por negocio/módulo y 200 pendientes en total. Los pedidos pendientes deben rechazarse desde caja si no se atenderán; no vencen automáticamente.

Las mesas creadas por servidor tienen un recibo de importación persistente. Una subida anterior a un cambio remoto de pedidos se rechaza para forzar la descarga de la versión nueva. Los recibos también protegen contra la pérdida accidental de una mesa durante una subida. Los platos tienen identificadores públicos estables que se conservan al editar sus recetas. Las líneas de venta web se resuelven por ese identificador antes de cobrar.

## Verificación local

No se ejecutaron pruebas contra cuentas, datos o servicios de producción. No se instalaron dependencias.

```powershell
node --test functions/tests/menu-integration.test.cjs
node --test scripts/test-menu-frontend.cjs scripts/test-menu-admin.cjs
npm run audit:structure
npm --prefix functions run lint
```

Los fixtures de servidor verifican concurrencia, idempotencia, precios manipulados, aislamiento de clientes, mesas ocupadas, estados, cobro y conservación de comandas. Las pruebas DOM cargan la estructura completa del menú, sustituyen la red por fixtures locales y verifican envío, errores, catálogo vacío, desconexión y nutrición. Las pruebas administrativas usan el shell real de LuRo y una sesión simulada.

## Activación pendiente de publicación explícita

El código está preparado localmente; las nuevas funciones aún no están desplegadas y el sitio alojado sigue en la versión anterior. La instrucción de integración no cambia la política del proyecto de exigir una instrucción explícita para publicar.

Al autorizar la publicación:

1. Revisar y respaldar los cambios de este trabajo junto con los cambios previos del usuario, sin incluirlos inadvertidamente en un commit de integración. Hay modificaciones previas en los mismos archivos.
2. Publicar las funciones nuevas y los cambios de `upsertOwnerData`, y después el hosting de LuRo mediante el flujo seguro existente. No desplegar reglas ni secretos.
3. Guardar/sincronizar la configuración del negocio desde LuRo. Esto requiere una sesión administrativa y elección del módulo real; no se inventa un propietario en la app cliente.
4. Sincronizar `public/menu/` con `dist/` del checkout del sitio, ejecutar sus pruebas, empaquetar y publicar con Sites conservando su acceso actual. Su ID es `appgprj_6ae2a999341881919aa0e0bf11820557`.
5. Comprobar el flujo real con un pedido autorizado por el negocio. La prueba local no sustituye esa comprobación posterior al despliegue.

No se cambiaron Firebase Auth, reglas, secretos, datos de producción ni políticas de acceso al sitio. El sitio conserva su acceso restringido: abrirlo al público requiere una decisión expresa adicional. La app requiere internet para pedidos, seguimiento y perfiles. La interfaz puede guardarse sin conexión, pero no confirma pedidos offline. Las notificaciones son avisos dentro de la app abierta; no hay push con la app cerrada. Las existencias registradas por cajas offline pueden estar desactualizadas hasta sincronizarse; no se cambió la arquitectura global del POS para descontar inventario en el servidor.
