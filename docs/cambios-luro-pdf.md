# Cambios del PDF «Cambios en LURO»

Implementación local, sin despliegue ni pruebas contra servicios de producción.

- Registro público: tarjeta virtual con nombre, teléfono y código LURO, apta para captura de pantalla. El acceso privado al historial sigue separado del código de identificación.
- Menú: campo de código opcional antes de comprar. El servidor valida el código dentro del negocio y módulo, y registra su estado de verificación y membresía en caja. También conserva el código al importar el pedido a la mesa.
- Administración de app: banco de los 200 registros más recientes del módulo, con búsqueda, tarjeta, cédula y teléfono. La validación de identidad usa las tareas existentes y un cliente de fidelización con la misma cédula.
- Paquetes: asignación administrativa a miembros verificados, visible en su perfil. Es una descripción del paquete; no realiza cobros ni modifica automáticamente beneficios.
- Navegación: Configuración y Autorizaciones permanecen en Administración de app. Entrenamientos, Agregar plato, Clientes y puntos, RNC, reportes de compras y Ventas pasan al panel operativo. Se mantienen los permisos existentes.
- Administrador: se elimina la solicitud adicional de contraseña al abrirlo; se conserva la sesión y la restricción de colaboradores.
- Controles: menú, alertas y asistente fijos arriba; alertas desplegables bajo la barra.
- Cachés: versiones de recursos y service workers actualizadas.

## Verificación

38 pruebas locales aprobadas: 20 de backend con base en memoria, 8 de administración, 8 del menú, 1 de controles en navegador a cuatro tamaños y 1 de inicio móvil. Validación de estructura y sintaxis aprobadas. El proyecto no define build ni comprobación de tipos. No se instalaron dependencias ni se modificaron reglas o configuración de Firebase.

El código identifica compras y no concede acceso al historial privado. La asignación de paquetes no envía mensajes externos. Los perfiles antiguos reciben su código cuando repiten el registro desde su sesión original; no se ejecutó ninguna migración de producción.
