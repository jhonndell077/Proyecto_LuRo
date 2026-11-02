# Publicación y sincronización del menú — 1 de noviembre de 2026

Diagnóstico: la consulta del catálogo publicado de jssantana077 / COCINA devolvió Pechuga de 8 Oz, 25 porciones, RD$725. No devolvió Marcopolo. Esto confirma que su ausencia ocurre antes del renderizado del menú; la información pública no permite distinguir si el registro local no se subió, está oculto o tiene un precio inválido. No se leyeron credenciales ni se cambiaron datos del negocio durante esta revisión.

Se añadió Publicación en The Proyect a Disponibilidad, para administradores. Al abrir se consulta el catálogo; cada plato indica si está oculto, pendiente, con precio inválido, con identificador duplicado o publicado. Sincronizar disponibilidad usa guardarDatos y la subida autenticada existentes; después vuelve a consultar y confirma los platos publicados. Mostrar y sincronizar en una ficha oculta cambia explícitamente esa ficha a visible. Un fallo de subida permanece pendiente. El enlace abre el menú canónico de LuRo con el mismo propietario y módulo, evitando depender del dominio externo que devolvió 403.

Las existencias públicas pueden ser menores que las locales por reservas activas. Una porción debe mostrarse y puede pedirse: no hay umbral de exclusión por tener una sola unidad. Se preserva la validación del servidor al enviar pedidos.

La actualización visible de menú/pedidos se consulta cada 2 segundos y al recuperar foco/conexión en el menú cliente. LuRo consulta la base general cada 5 segundos. Sigue siendo consulta periódica, con latencia de red, sin promesa de entrega instantánea ni notificaciones con la app cerrada. No se modifican reglas Firebase, secretos, funciones ni configuración de acceso del sitio externo.

Validación local: 42 pruebas distintas de integración de servidor, menú cliente, administrador, publicación y dos recorridos Chrome. Se verificaron dos platos simultáneos (25 y 1 porciones), falta de publicación, publicación explícita, aislamiento, error de subida, permisos y tamaños de 320 a 1440 px. Sintaxis JS, lint del backend y audit:structure completados. No hay scripts de build/types/lint de frontend en el proyecto. Las pruebas usan fixtures; no se crearon pedidos ni cobros productivos.

Para reconciliar el estado del iPhone se necesita abrir la versión actualizada y usar Disponibilidad → Sincronizar disponibilidad (o Mostrar y sincronizar si el plato estaba oculto). El despliegue por sí solo no puede subir registros que solo existen en el almacenamiento local de ese dispositivo.
