# Guía Maestra LuRo: funcionamiento por módulos y conexiones entre módulos

> Esta guía está pensada para que cualquier usuario (operativo o administrativo) entienda **qué hace cada módulo**, **qué datos toca** y **cómo se conecta con los demás**.

---

## 1) Mapa general del sistema (visión rápida)

LuRo opera sobre 6 ejes conectados:

1. **Almacén**: entrada y control de insumos base.
2. **Producción Interna**: transformación de insumos en semielaborados.
3. **Agregar Plato (Menú)**: creación de producto vendible con receta y costos.
4. **Disponibilidad / ABC**: control de stock del plato terminado.
5. **Registrar Salida (Ventas)**: cobro, descuento de inventario y facturación.
6. **Historiales**: auditoría de entradas, producción, ventas y autorizaciones.

En términos simples:

**Entradas Almacén → Producción Interna (opcional) → Plato/Receta → Registrar Salida → Historiales + Factura + KPIs**

---

## 2) Módulo por módulo (qué hace y qué conecta)

## Módulo A: Almacén (Entradas y stock base)

### ¿Para qué sirve?
- Registrar compras/entradas de ingredientes.
- Llevar existencia real (`actual`), objetivo (`ideal`) y costo unitario.

### Función principal
- `agregarAlmacen()`.

### Qué hace internamente
- Valida permisos de entrada manual.
- Si el producto existe, convierte unidades y recalcula costo unitario por promedio ponderado.
- Si no existe, crea el producto en almacén.
- Registra la operación en `db.entradas` para trazabilidad.

### Conexiones
- Alimenta a **Producción Interna** (insumos para fabricar semielaborados).
- Alimenta a **Agregar Plato** (recetas consumen insumos de almacén/producción).
- Alimenta a **Registrar Salida** (cuando receta no encuentra semielaborado, baja de almacén).
- Alimenta reportes de faltantes/pedidos.

---

## Módulo B: Producción Interna (Semielaborados)

### ¿Para qué sirve?
- Convertir insumos de almacén en productos intermedios (ej. salsa base, mezcla, prep).

### Función principal
- `procesarNuevaProduccion()`.

### Qué hace internamente
- Toma filas de insumos, cantidad y unidad.
- Convierte unidades y descuenta en tiempo real del almacén.
- Crea/actualiza `db.produccion_stock` con costo unitario calculado.
- Registra el movimiento en `db.historial_prod`.

### Conexiones
- Recibe insumos desde **Almacén**.
- Entrega semielaborados a **Agregar Plato** (como ingredientes de receta).
- En venta, **Registrar Salida** descuenta primero de producción si aplica.

---

## Módulo C: Agregar Plato (ingeniería de producto)

### ¿Para qué sirve?
- Construir el producto final de venta (nombre, receta, precio, costos, impuestos).

### Función principal
- `guardarPlatoNuevo()`.

### Qué hace internamente
- Recalcula costo de receta (`recalcularCostoReceta()`).
- Guarda/actualiza plato con: `precio`, `costo`, `receta`, `stock`.
- Si ya existe (nombre/owner/módulo), actualiza; si no, crea.

### Conexiones
- Toma costos desde **Almacén** y/o **Producción Interna**.
- Entrega platos al módulo **Registrar Salida** para cobro.
- Se refleja en **Disponibilidad/ABC** para control de stock terminado.

---

## Módulo D: Disponibilidad + Departamentos A-B-C

### ¿Para qué sirve?
- Mostrar si un plato está vendible según stock del plato y presión de insumos.
- Priorizar atención operativa:
  - Rojo: sin stock.
  - Amarillo: poco stock.
  - Verde: stock saludable.

### Conexiones
- Usa datos del plato (stock y receta) + almacén/producción para alertas.
- Guía decisiones antes de vender en **Registrar Salida**.

---

## Módulo E: Registrar Salida (ventas, factura y descuento automático)

### ¿Para qué sirve?
- Cerrar la venta de mesa/cuenta y ejecutar todo el circuito financiero-operativo.

### Función principal
- `finalizarVenta()`.

### Qué hace internamente
1. Toma carrito de la mesa activa.
2. Calcula precios/beneficios de cliente si aplican.
3. Valida riesgos de stock.
4. Si faltan insumos, solicita autorización y registra en `db.autorizaciones`.
5. Al confirmar:
   - descuenta stock del plato terminado,
   - descuenta ingredientes desde producción o almacén,
   - registra líneas en `db.ventas` con ganancia,
   - genera factura visual/resumen,
   - limpia mesa para nuevo ciclo.

### Conexiones
- Consume platos desde **Agregar Plato**.
- Consume inventario desde **Producción Interna** y **Almacén**.
- Escribe en **Historial de Ventas** y **Autorizaciones**.
- Alimenta indicadores administrativos y reportes.

---

## Módulo F: Historiales y Auditoría

### ¿Para qué sirve?
- Tener trazabilidad completa de quién hizo qué, cuándo y con qué impacto.

### Tablas de historial
- `db.entradas`: entradas de almacén.
- `db.historial_prod`: producción interna.
- `db.ventas`: ventas y ganancia.
- `db.autorizaciones`: ventas forzadas por faltantes.

### Conexiones
- Consolida eventos de todos los módulos operativos.
- Permite control administrativo, revisión y mejora de procesos.

---

## 3) Conexión entre módulos (matriz)

| Módulo origen | Entrega a | Qué entrega |
|---|---|---|
| Almacén | Producción Interna | Insumos con costo unitario y unidad base |
| Almacén | Agregar Plato | Ingredientes disponibles para receta |
| Producción Interna | Agregar Plato | Semielaborados para receta |
| Agregar Plato | Registrar Salida | Producto vendible (precio, costo, receta) |
| Registrar Salida | Historial Ventas | Venta, total y ganancia por línea |
| Registrar Salida | Autorizaciones | Bitácora de faltantes autorizados |
| Entradas/Producción/Ventas | Reportes/Historial | Trazabilidad operativa y financiera |

---

## 4) Flujo completo “de compra a venta” (paso a paso)

1. Se compra mercancía y se registra en **Almacén**.
2. Si hace falta, se transforma en **Producción Interna**.
3. Se define/actualiza receta en **Agregar Plato**.
4. Se revisa **Disponibilidad/ABC** para priorizar producción/reposición.
5. En **Registrar Salida**, se vende:
   - cobra,
   - descuenta inventario multicapa,
   - registra venta y ganancia,
   - factura y cierra mesa.
6. Todo queda en **Historiales** para análisis y control.

---

## 5) Explicación del “x3” en Venta Recomendada

El cálculo de recomendación sale de `recalcularCostoReceta()`:

- Calcula `costoFinal` (costo base + impuestos si están activos).
- Luego fija:
  - `p_recom = costoFinal * 3`

Por eso en interfaz aparece “Venta Recomendada (x3)”.

---

## 6) ¿Por qué “Registrar Salida” parece magia?

Porque en una sola confirmación integra 4 capas simultáneas:

- **Comercial**: total, precios aplicados y factura.
- **Inventario**: descuenta plato + ingredientes.
- **Control**: valida faltantes y exige autorización cuando aplica.
- **Gestión**: registra historial y deja la mesa reiniciada.

No es magia: es una orquestación transaccional del negocio en un solo punto operativo.

---

## 7) Buenas prácticas operativas por módulo

### Almacén
- Registrar siempre costo total real de la compra.
- Mantener unidad consistente para evitar errores de conversión.

### Producción Interna
- Registrar lotes reales y no “aproximados”.
- Revisar alertas de restante antes de guardar producción.

### Agregar Plato
- No dejar receta incompleta.
- Usar precio recomendado x3 como referencia, no obligación.

### Registrar Salida
- Confirmar mesa activa y cantidades antes de cerrar.
- Evitar autorizaciones forzadas recurrentes (es síntoma de reposición fallida).

---

## 8) Glosario corto

- **Insumo**: ingrediente base comprado (almacén).
- **Semielaborado**: producto intermedio fabricado internamente.
- **Plato**: producto final vendible.
- **Stock ideal**: meta operativa de inventario.
- **Stock actual**: existencia disponible al momento.
- **Autorización**: excepción controlada para vender con faltantes.
