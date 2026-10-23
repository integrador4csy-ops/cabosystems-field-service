# Carga y navegación de la web

Actualizado el 21 de octubre de 2026.

La navegación anterior desmontaba el apartado al salir y volvía a consultar todos sus datos al regresar. Ahora `RetainedView` conserva únicamente las vistas visitadas mediante React Activity: mantiene su estado y su DOM, mientras React desconecta sus efectos, suscripciones y temporizadores al ocultarlas. Cada vista conserva su propio módulo y límite Suspense. Su código se puede preparar en segundo plano sin montar la vista.

Tareas, directorio de proyectos, agenda, colaboradores, invitaciones y conversación de chat conservan sus datos al reactivarse y los actualizan sin sustituirlos por una pantalla de carga. La primera visita reutiliza los datos preparados por intención cuando están disponibles; de lo contrario consulta el servidor. Los filtros de calendarios no se restablecen al volver. El directorio no refresca sobre un editor con cambios pendientes.

El estado retenido vive en memoria durante la sesión: no se guarda información de estas vistas en una caché persistente nueva. Todo el árbol se reinicia al cambiar usuario, rol o estado activo. Las escrituras siguen pasando por las autorizaciones existentes del servidor.

El radar consulta ubicaciones y perfiles en paralelo, descarta respuestas anteriores y conserva la actualización de ubicaciones por Realtime. El sondeo de respaldo pasa de cada 1.5 segundos a cada 15 segundos, únicamente con radar activo y documento visible. Al recuperar foco refresca. Al volver al mapa se restaura el centro y zoom. Las notificaciones globales del chat siguen disponibles fuera del apartado.

Las vistas previas de archivos del chat se regeneran al reactivar sus efectos; se liberan sus URLs temporales al ocultar o cambiar el archivo.

Validación: compilación web y 56 pruebas existentes aprobadas. La vista aislada de agenda permite alternar apartados con `?role=admin&slow=1`, simulando dos segundos de consulta. Se comprobó que al volver el calendario permanece visible durante la actualización, que Oficina sigue desmarcado y que un borrador de la otra vista conserva su texto. Los datos de esta prueba son ficticios. No se ha hecho una medición de latencia con una sesión real ni se ha publicado el frontend.

## Precarga de periodos de agenda

La agenda consulta el mes completo y comparte esos datos con las vistas semanal y diaria. Después de cargar el periodo visible, precarga los meses +1 y -1, secuencialmente, si la conexión lo permite y no hay consultas prioritarias en curso. La ventana avanza con la navegación. Navegar a un periodo almacenado lo muestra desde el primer render. Una espera cancelable de 250 ms agrupa los cambios rápidos de fecha antes de iniciar la consulta del periodo donde se detiene el usuario. Al ocultar la vista se cancelan tanto esa espera como la cola de precarga pendiente; una consulta ya iniciada puede terminar.

La cuadrícula con sus fechas permanece visible durante cualquier consulta. Un aviso discreto muestra Cargando eventos… si el periodo aún no se conoce, o Actualizando… si se están renovando datos visibles. No se muestran avisos de calendario vacío ni Sin eventos hasta disponer de datos para el periodo. Las acciones de navegación siguen disponibles.

`AgendaRangeCache` es una caché por sesión, compartida entre la vista y su precarga por intención, exclusivamente en RAM. Retiene un máximo de cinco rangos mensuales y 20,000 ocurrencias; no son bytes ni una estimación fija de MB. El rango visible queda protegido frente a la expulsión por precargas; se retiran primero otros rangos. Si los eventos ocupan todo el presupuesto, la ventana puede contener menos de cinco meses. Los accesos actualizan la prioridad de retención. Los datos caducan a los dos minutos, pero se pueden mostrar mientras se renuevan. Las solicitudes al mismo rango en curso se comparten. Una respuesta fallida no se almacena. Las respuestas iniciadas antes de invalidar no pueden repoblar la caché anterior.

Actualizar, recuperar foco, los cambios locales por Realtime, guardar un evento y cerrar la configuración Google invalidan los periodos almacenados. Después se reconstruye la precarga. No se comparten datos entre sesiones ni se escribe en localStorage.

Siete pruebas adicionales comprueban reutilización mes/semana/día, ocurrencias recurrentes, consultas simultáneas, invalidación, caducidad, límites de memoria, protección del mes visible, ventana móvil, reintentos y separación de cachés. En navegador con consultas ficticias de dos segundos se verificaron cambios mes → semana → semana del mes siguiente → día → Hoy sin una nueva pantalla completa de carga una vez precargados. También se verificó el salto de seis meses: permanece la cuadrícula del destino con Cargando eventos…, sin afirmar que está vacía durante la consulta.

## Precarga del código y de los datos

La sección inicial tiene prioridad. Después de su primera consulta se preparan los datos generales del radar y el código de tareas y agenda, de uno en uno y cuando el navegador dispone de tiempo libre. Ya no se descargan todos los módulos al iniciar sesión ni se prepara el mapa antes de autenticar.

El menú precarga la sección al mantener el puntero 120 ms, enfocarla con teclado o tocarla. El código comparte la misma promesa con React.lazy; los datos comparten una caché de sesión con la vista. Los detalles actuales, límites, invalidación, precarga de conversaciones y restricciones de red se documentan en [Carga de secciones web](web-loading-performance.md).