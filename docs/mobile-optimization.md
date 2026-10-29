# Optimización móvil

## Cambios

- Check-in/out nativo: foto JPEG en el directorio persistente de la app y operación en SQLite antes de informar que se guardó. Se conserva la hora de captura del registro, el GPS y la cuenta. El mensaje diferencia guardado local de confirmación en servidor.
- Sincronización con la app activa al recuperar red, regresar a primer plano o guardar una operación. Un solo trabajador procesa en orden; reintentos de 5 segundos a 5 minutos. Cuando no hay pendientes o se necesita revisión, no hay consultas periódicas a la cola.
- UUID estable para registro, tarea creada y ruta de foto: una respuesta perdida no genera otro registro. Las tareas existentes se buscan únicamente dentro de la villa y del técnico. Los permisos del servidor siguen siendo obligatorios.
- La subida de pendientes usa inserción sin sobrescritura. Si una respuesta se pierde y la imagen ya existe, se comprueba su existencia antes de reutilizar su URL. Funciona con los permisos actuales de inserción y lectura del bucket de evidencias.
- Pendientes separados por cuenta, con aviso y reintento manual. Un error de permiso detiene la cola para no enviar una salida antes de una llegada rechazada. Los pendientes y fotos no se borran al cerrar sesión.
- Copia de villas por cuenta para recuperar el contexto sin red después de haberlo cargado. El servidor vuelve a validar permisos al sincronizar.
- Fotos: decodificación limitada a 1600 × 1600, proporción conservada, sin ampliar imágenes pequeñas, JPEG a 0.75. Las referencias de imagen se liberan y la copia de envío se elimina tras confirmar la operación.
- GPS: se eliminaron coordenadas simuladas como respuesta a un error. Se acepta una última posición de hasta un minuto con precisión de hasta 100 m; se solicita una posición real si no existe. Se renueva antes de enviar si pasaron dos minutos.
- Chat: gesto de respuesta con Gesture Handler y Reanimated; movimiento en el hilo de interfaz y retorno a JavaScript solo para activar la respuesta. Se reinicia el desplazamiento al reciclar una burbuja y se comprueba su identidad antes de responder.
- Personal: colaboradores e invitaciones en FlashList, conservando controles, modales y acciones. La web mantiene su flujo de envío directo; no carga SQLite/WASM.
- Peticiones de Supabase: límite de 60 segundos con cancelación del solicitante conservada, para no bloquear indefinidamente una sincronización.

## Compilación necesaria

Se añadieron `expo-sqlite`, `expo-image-manipulator`, `@react-native-community/netinfo` y `react-native-gesture-handler` usando las versiones compatibles indicadas por Expo. Hace falta una nueva compilación nativa; actualizar solamente JavaScript no incorpora estas dependencias.

No se requieren cambios de esquema ni permisos adicionales en Supabase. Un técnico sin una tarea asignada y sin permiso para crearla verá el registro pendiente de revisión; un administrador debe resolver la asignación o el acceso y después reintentar.

La sincronización sucede con la app abierta y activa. Si el sistema cierra la app, los pendientes permanecen guardados y se reanudan al abrirla con la misma cuenta. La primera carga de villas y el inicio de sesión requieren conexión.

## Verificación en teléfono

### Navegación y pantallas de 120 Hz

Las pestañas y el stack usan `freezeOnBlur` para evitar renders de pantallas inactivas. Los servicios globales de sincronización y seguimiento quedan fuera de esas pantallas. El stack mantiene sus transiciones nativas. iOS configura explícitamente `CADisableMinimumFrameDurationOnPhone: true` para admitir frecuencias altas en dispositivos compatibles.

Estos ajustes no garantizan 120 FPS. A 120 Hz el presupuesto es de unos 8,33 ms por cuadro. En Android hay que verificar la frecuencia permitida para la app en el teléfono, el ahorro de batería y los tiempos reales de renderizado. El indicador del sistema que muestra 120 Hz no demuestra que la app produzca 120 cuadros por segundo.

Comprobar en una nueva compilación de producción el cambio entre tareas, agenda, personal y chat; volver a cada pestaña y verificar actualización de datos, estado de check-in, cámara y foco del teclado. Medir cuadros perdidos durante el cambio de pantalla y el desplazamiento. No se ha medido este comportamiento en un dispositivo conectado.

Usar una compilación de producción en el mismo teléfono y con los mismos datos antes/después. Aún no hay mediciones reales de FPS, arranque o batería.

1. Abrir una villa con conexión; activar modo avión y guardar llegada y salida. Comprobar el aviso de pendientes y las horas originales.
2. Cerrar la app completamente, reabrir sin red y comprobar que siguen los pendientes y las villas previamente cargadas.
3. Recuperar red con la app activa. Comprobar una sola llegada y una sola salida, en orden, y la desaparición del aviso.
4. Interrumpir red durante la subida y durante el guardado remoto; reanudar y comprobar que no hay duplicados.
5. Cambiar de cuenta con pendientes. Verificar que no se muestran ni envían los de otra cuenta; volver a la original y sincronizar.
6. Revocar la asignación de una tarea. Comprobar el aviso de revisión y que el registro permanece guardado. Corregir la asignación y reintentar.
7. Denegar GPS y comprobar que no se permite registrar una ubicación ficticia.
8. Recorrer una conversación extensa y la lista de personal, probar desplazamiento vertical, gesto de respuesta, pulsación larga, reacciones, edición, invitaciones y refresco.
9. Medir arranque en frío (mediana de 10 aperturas), memoria tras recorrer las listas y volver atrás, fotogramas perdidos y batería durante una jornada representativa. Registrar modelo, versión de Android y número de registros; no extrapolar resultados de desarrollo a producción.

Las pruebas automáticas usan SQLite real en el equipo y un servidor simulado para los fallos de red y permisos. No escriben datos de producción ni sustituyen la verificación nativa.

## Permisos de avance por villa

El detalle de Tasks consulta `get_task_permissions` con la sesión autenticada al abrirse o volver al primer plano de navegación. Los participantes, integradores y técnicos asignados a la villa pueden cambiar el estado y marcar subtareas aunque la tarea pertenezca a otro compañero o no tenga responsable. El acceso concedido por villa, desarrollo o de forma global permite reportar avances en todas las villas incluidas en ese alcance. Administradores y supervisores activos pueden editar contenido únicamente dentro de las villas que pueden consultar. El servidor protege los demás campos y bloquea creación, eliminación, reasignación y traslado de tareas para miembros ordinarios. La app requiere su código actualizado; la migración de permisos ya está aplicada.

Validación: `node supabase/tests/task-progress.local.mjs`, `npm test` y `npm run typecheck` en móvil. Las pruebas locales usan datos ficticios y no alteran la base de producción.

La asignación de una tarea es informativa: identifica al encargado y permite organizar el trabajo; no concede ni restringe permisos. Cambiar al encargado no agrega ni elimina participantes de una villa. El detalle móvil requiere permisos del servidor y no habilita avances por coincidir con `asignado_a`. Las membresías existentes se conservan: los accesos se administran en el equipo de la villa.

## Transición de periodos en Agenda

El gesto horizontal utiliza siete páginas contiguas: actual, tres anteriores y tres siguientes. Los controles de búsqueda, vista, calendarios y navegación se muestran una sola vez y permanecen fijos. Solo se desplazan las fechas y los eventos; la cuadrícula llega hasta el borde de cada periodo para que no haya un margen vacío entre calendarios. El calendario vecino ya se ve mientras sale el actual; al soltar se completa el desplazamiento con una duración adaptada a la distancia y velocidad (80–200 ms). Un nuevo gesto interrumpe la animación y continúa desde su posición actual, sin esperar a que React actualice el título del mes y año. Las páginas se recentran conservando el contenido bajo el dedo, incluso cuando se acumulan varios cambios de periodo. Desde el inicio de sesión se prepara una ventana por cuenta de siete periodos: el actual, tres anteriores y tres siguientes. Al cambiar el centro se conservan los seis que se solapan y se carga solo el nuevo extremo. La ventana y el último índice/vista se guardan en el almacenamiento persistente de la app y se restauran antes de consultar la red. La precarga tiene como máximo dos solicitudes simultáneas y continúa al usar otras pestañas. En segundo plano del sistema se guarda y se pausa la red; al volver se revalida sin vaciar los datos visibles. Se revalidan los datos con antigüedad de un minuto, y guardar o borrar eventos invalida y vuelve a preparar la ventana. Cuando un mes guardado cubre una semana o un día, se reutiliza su contenido sin descargarlo otra vez. Un gesto corto o cancelado vuelve suavemente a su posición. Las animaciones usan Reanimated en el hilo de interfaz, respetan Reducir movimiento y aceptan cambios consecutivos de dirección mientras transicionan. Buscar, abrir un evento, cambiar de vista o salir de la pantalla descarta gestos de un contexto anterior. Rotar cancela el arrastre y conserva el destino ya confirmado. Los límites de fecha conservan el periodo actual.

La primera sincronización de una ventana sin datos guardados necesita conexión. Después se muestran inmediatamente los periodos persistidos, incluso sin red. Las cuentas se guardan por separado y las respuestas tardías de una sesión cerrada no pueden llenar la caché de otra. El servicio no solicita permisos nuevos de ejecución en segundo plano.

El cambio entre mes, semana y día mantiene una sola FlashList interactiva; los seis vecinos usan vistas previas limitadas a 24 filas, con todos los eventos conservados en caché. Al entrar en un vecino, la lista activa sigue mostrando el conjunto completo. Los formatos de fecha y hora se reutilizan en lugar de construir un formato internacional por celda/evento. Sin búsqueda se omite normalizar títulos y descripciones. Las semanas y días cubiertos por un mes guardado se leen sin esperar al efecto de selección ni a la red.
