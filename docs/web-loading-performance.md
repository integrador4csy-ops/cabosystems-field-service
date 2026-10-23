# Carga de secciones web

La sección restaurada al iniciar sesión tiene prioridad. No se montan todas las vistas ni se solicitan todos sus datos durante el inicio. Cuando la primera vista termina su carga, una cola de tiempo libre prepara la información general del radar y el código de tareas y agenda. El resto se descarga al mostrar intención o al abrirlo.

## Precarga por intención

El menú comienza la descarga del módulo tras mantener el puntero 120 ms sobre una opción. Con teclado o pantalla táctil se inicia al enfocar o tocar. La navegación y la precarga comparten la misma promesa de importación. Los datos se preparan después de la primera carga, en una cola de una sección a la vez. Si cambia el destino, se omiten las consultas opcionales que quedaron en cola para el anterior. Las conversaciones del chat también preparan sus mensajes al enfocarlas o mantener el puntero.

No se especula con la pestaña oculta, sin conexión, en 2G ni con ahorro de datos. Una precarga fallida no bloquea la navegación. La carga solicitada directamente por el usuario sigue funcionando.

## Caché de datos

`SessionQueryCache` vive dentro del proveedor identificado por usuario, rol y estado activo. Guarda datos únicamente en RAM y se limpia al desmontar la sesión. Las respuestas tardías no restauran la caché después de cerrarla. El tamaño está limitado a 20 recursos.

Los proyectos, tareas y equipo tienen una frescura de 30 segundos; grupos y conversaciones, de 15 segundos; radar, de 10 segundos. Una vista puede mostrar su copia anterior mientras obtiene una nueva. Las consultas pendientes se comparten; un refresco posterior a una escritura sustituye los resultados anteriores. Los botones de actualizar, las escrituras y los eventos de Realtime mantienen las actualizaciones explícitas.

La agenda comparte su caché de periodos con la precarga del menú. Cambiar entre mes, semana y día reutiliza el periodo ya obtenido. La navegación especulativa prepara solo los dos meses contiguos y conserva el límite de cinco periodos y 20 000 ocurrencias. No se añaden notificaciones ni sincronización de Google en segundo plano.

Se mantienen las comprobaciones de permisos y RLS de Supabase. No se guarda contenido privado en localStorage, sessionStorage ni cachés de disco como parte de esta optimización.

## Verificación

Las pruebas de `session-query-cache`, `section-resources`, `module-preload` y `agenda-range-cache` comprueban solicitudes compartidas, espera de la primera sección, secuencia de precargas, cancelación de destinos anteriores, límites de memoria, errores, caducidad, respuestas fuera de orden y separación de sesiones. La compilación de producción comprueba todos los consumidores.

La primera apertura de una sección sin precarga todavía puede requerir conexión. No se establece una mejora de latencia en milisegundos sin medirla en la red real del usuario.
