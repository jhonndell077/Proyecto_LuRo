# Verificación POS transaccional con Firestore Emulator

Este escenario usa exclusivamente documentos sintéticos y el proyecto `demo-luro-pos3` en `127.0.0.1:18180`. No lee credenciales ni datos de producción, no despliega y no instala dependencias. El runner comprueba que Firebase CLI, Java y el JAR de Firestore ya estén disponibles; si falta alguno, se detiene.

## Ejecución

Desde la raíz del repositorio, sin otro emulador ocupando los puertos de `tests/pos3/firebase.emulators.json`:

```powershell
powershell -ExecutionPolicy Bypass -File tests/pos3/run-emulator.ps1
```

La configuración es exclusivamente de pruebas; no reemplaza `firebase.json` ni las reglas publicadas. Usa una copia local de las reglas de denegación total en `tests/pos3/firestore.rules`. Los logs se escriben en una carpeta temporal indicada al terminar.

## Cobertura

- Invoca los handlers reales de `functions/pos-operations.js` con Firestore Admin SDK contra el emulador. Solo sustituye el envoltorio callable y la resolución de sesión por identidades sintéticas; no sustituye transacciones ni persistencia.
- Activa un módulo de prueba, crea un pedido de nueve pechugas y recorre revisión, cocina, preparación y entrega.
- Entrega cuatro porciones, repite la misma solicitud y entrega las cinco restantes: exactamente nueve salidas y 72 Oz consumidas.
- Repite un pago con la misma clave: un pago y una factura.
- Compite por la última porción con dos actores: un único pedido reservado.
- Rechaza acceso cruzado entre negocios y recepción de inventario por un cocinero sin permiso.
- Impide enviar a cocina antes de pagar bajo la política `BEFORE_KITCHEN`.
- Comprueba que una lectura anónima directa sea rechazada por las reglas aisladas.
- Envía desde `menuSubmitOrder` al motor real, repite el mismo pedido y consulta `menuGetOrders`: conserva un único pedido y una reserva de una porción/8 Oz. Los contratos públicos no exponen `recipeSnapshot` ni `resourceReservations`, que permanecen en el pedido canónico.

## Límites

No certifica por sí solo Firebase Authentication publicado, reglas productivas, proveedores de pago, impresoras, facturación fiscal, disponibilidad del dominio externo de The Proyect ni Gestor WTF. La restauración de respaldos se verifica por el escenario independiente `scripts/phase1/run-emulator.ps1`; este escenario no importa ni borra datos reales.

El resultado de la ejecución debe registrarse con su fecha y revisión antes de publicar. Un fallo detiene la puerta de publicación; no debe interpretarse una prueba sintética como una migración o activación de módulos reales.

## Resultado local

El 3 de noviembre de 2026 se ejecutó satisfactoriamente el escenario completo con los handlers callable y transacciones reales del emulador. Resultado: `PASS`, entregas `4 + 5`, nueve unidades descontadas, reintentos de entrega y pago sin duplicados, un solo ganador de la última porción, aislamiento de negocio y permisos rechazados, política de pago antes de cocina verificada y lectura anónima denegada. La ampliación verificó además el menú web sobre el motor 3, su reintento con una sola reserva y la exclusión de recetas y reservas internas en ambas respuestas públicas. Logs locales de la ejecución ampliada: `C:\Users\USER\AppData\Local\Temp\luro-pos3-emulator-43770c7e351c422ca138a270264d7561`.
