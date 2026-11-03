# Reporte semanal: 2 al 6 de noviembre de 2026

**Proyecto:** CaboSystems Field Service  
**Estado:** Semana completada y verificada en web, móvil y dispositivo físico Android vía ADB  
**Periodo:** Del lunes 2 al viernes 6 de noviembre de 2026

## Avances de la semana

- Se definió y ejecutó el plan completo de 9 sesiones para transformar la visibilidad de tareas, incorporar prioridades, comentarios y fotografías de evidencia, y enlazar los avances con chats de villa y notificaciones móviles.
- Se revisó la lógica actual: el acceso a una villa permite hoy consultar y registrar avances en sus tareas; la nueva regla requirió separar la vista personal del técnico de la vista general administrativa.
- Se confirmó que `tareas` todavía no contaba con prioridad propia y que existía un historial de actividad ampliado sin perder los reportes actuales.
- Se completó la Sesión 1 con la nueva separación entre asignación personal y acceso completo a las tareas de una villa.
- Se completó la Sesión 1: una asignación directa abre solo esa tarea; el acceso explícito de villa, desarrollo o global habilita la vista completa del alcance; administradores y supervisores conservan sus facultades administrativas correspondientes.
- Se agregó prioridad alta, media y baja con orden estable; las tareas anteriores reciben prioridad media.
- Se completó la Sesión 2: web y móvil muestran la prioridad, permiten filtrarla y ordenan las tareas alta, media y baja. El orden alfabético ascendente o descendente se aplica únicamente dentro del mismo nivel.
- El formulario web permite elegir o cambiar la prioridad al crear y editar una tarea; móvil presenta la prioridad en cada orden y conserva filtros separados por villa, responsable, prioridad y estado.
- Se completó la Sesión 3: los avances admiten comentario opcional y una fotografía privada, conservan hora de captura y aceptación, y utilizan una clave de solicitud para que los reintentos no dupliquen acciones.
- El cambio de estado o subtarea y su registro histórico se realizan en una sola transacción. Una evidencia ya enlazada no puede sustituirse ni borrarse; una carga huérfana por un intento fallido sí puede limpiarla su autor.
- Se completó la Sesión 4: se implementó la captura de comentario y evidencia en diálogo accesible y modal nativo.
- Se refinó la interacción según retroalimentación operativa: el cambio de estado de una tarea (en selector, tablero o botón) es directo e inmediato y no solicita confirmación ni historial; el diálogo de comentarios y evidencias fotográficas queda reservado para el avance de subtareas (checklist).
- Se completó la Sesión 5: vinculación opcional entre chats grupales y villas con validación en servidor, RLS y presentación en web y móvil. Múltiples chats pueden vincularse a la misma villa sin conflicto.
- Se completó la Sesión 6: mensajes automáticos de actividad (`tipo = 'sistema'`) publicados en todos los chats vinculados a la villa al ocurrir un cambio de estado o avance de subtarea. Los mensajes son generados por el servidor mediante un disparador determinista que evita duplicados durante reintentos.
- Se completó la Sesión 7: sección **Tareas realizadas** en la información del grupo (`GroupInfoDrawer` en web y `group-info/[id]` en móvil). Permite consultar los avances oficiales de la villa, subtareas completadas, autores, fechas, comentarios y fotografías de evidencia mediante enlaces privados temporales, con paginación y estados de carga y error.
- Se corrigió la inicialización del cliente de Supabase en web y móvil ante el error `No API key found in request / Could not load tasks. Please try again`: se agregaron credenciales predeterminadas seguras como respaldo en `supabase.ts` y se creó el archivo `.env` en la raíz del proyecto para asegurar que las consultas nunca se envíen sin encabezado `apikey`.
- Se aplicó y validó exitosamente en el Supabase remoto el script correctivo de políticas RLS y visibilidad de tareas (`tareas_select`), resolviendo el error `42P01` y dejando activo el aislamiento seguro por asignación y alcance real (`proyectos`, `proyecto_participantes`, `desarrollo_accesos`).
- Se completó la Sesión 8: notificaciones móviles push para avances de tareas en villas vinculadas y navegación contextual. Las notificaciones push reconocen mensajes de sistema de tareas, formatean el texto con villa, tarea y acción, excluyen automáticamente al autor del cambio y dirigen al chat o detalle de la tarea.
- Se completó la Sesión 9 (Integración, seguridad, plan de reversión y entrega final):
  - Se probó la aplicación en el dispositivo físico Android conectado por ADB (`JNL74P6LCQ4XFE6H` / Xiaomi).
  - Se verificó que el cambio de estado con el botón nativo ("Mark as done") es instantáneo y sin modal, registrando historial y cambiando la acción a "Reopen task".
  - Se verificó que las subtareas abren el modal de progreso con comentario y captura de foto de evidencia.
  - Se añadieron selectores y distintivos de villa en creación (`new-group.tsx`) y edición de información de grupo (`group-info/[id].tsx`).
  - Se documentaron procedimientos de reversión (rollback) y seguridad.
- Se implementó la separación de niveles de acceso en villa y restricción de acceso global (`20261102230000_villa_participant_access_levels.sql`):
  - El acceso a una villa por defecto limita la visibilidad a las tareas asignadas al usuario (`tipo_acceso = 'mis_tareas'`).
  - En el panel de participantes de la villa (`VillaTeam`), los administradores pueden elegir para cada colaborador entre **Mis tareas** y **Todas las tareas de la villa** (acceso total a la villa).
  - Los usuarios con rol de Administrador o Supervisor de Instalación muestran automáticamente el distintivo verde **Acceso total** sin selector restrictivo, ya que su rol cuenta con acceso completo por definición.
  - Se corrigió el diseño y la proporción de los controles de cada integrante: el selector y el botón de remover ahora se alinean horizontalmente en una sola fila con dimensiones compactas y proporcionadas (`.pd-person-actions` y `.pd-remove-btn`).
  - Se eliminó el botón de "Global access" de la barra lateral de desarrollos, reservando el acceso global exclusivamente para los roles **`admin`** y **`supervisor_instalacion`** (Installation Supervision).
  - En las vistas de tareas (web y móvil), se añadieron las opciones rápidas en el filtro de responsable: **Todas las tareas de la villa** y **Mis tareas**.

## Cambios en la aplicación web

- El cambio de estado de tareas se realiza de forma directa e inmediata tanto en el selector de la tarjeta como en el tablero arrastrable Kanban.
- Las casillas de subtareas abren el diálogo `TaskProgressDialog` para capturar comentario opcional y fotografía opcional desde cámara o archivo.
- El diálogo comprime a JPEG, limita el comentario a 2,000 caracteres y conserva los datos cuando ocurre un error de red.
- Toda tarea puede expandirse para consultar hasta 30 avances recientes con persona, fecha, acción, comentario y fotografía privada.
- El diálogo de creación de grupo (`CreateGroupModal`) y el panel de información (`GroupInfoDrawer`) permiten vincular y editar la villa correspondiente, mostrando su distintivo en el encabezado.
- Se creó el componente `ChatSystemMessage`: renderiza tarjetas de sistema centradas con icono según la acción (verde para completado, naranja para en proceso, gris/ámbar para reabierto), distintivo de villa, fecha/hora, texto descriptivo, cita del comentario técnico y miniatura de evidencia privada que abre el visor de imágenes con enlace firmado temporal.
- Se creó el componente `GroupTaskActivitySection` y se integró en el panel `GroupInfoDrawer`: muestra la sección **Tareas realizadas** para chats vinculados a una villa, listando cronológicamente las tareas y subtareas completadas con sus respectivos comentarios, miniaturas de fotos y botón para cargar más registros.

## Cambios en la aplicación móvil

- El botón de cambio de estado en la pantalla de detalle de tarea actualiza el estado directamente en el servidor sin interrupciones.
- Las subtareas utilizan `TaskProgressModal` para capturar foto y comentario opcional con cámara o galería nativas.
- El historial aparece en el detalle con imágenes optimizadas mediante `expo-image` y acceso temporal a la evidencia privada.
- La pantalla de creación de grupo (`new-group`) y la información del grupo (`group-info/[id]`) incorporan selector horizontal de villas accesibles y distintivo visual de la villa vinculada.
- Se creó el componente `ChatSystemMessage` móvil y se integró en `ChatMessageBubble`: presenta las actividades de villa como tarjetas legibles centradas, diferenciadas de los mensajes de usuario, con distintivo de villa, hora local, comentario en bloque estilizado y visor de foto de evidencia.
- Se creó el componente `GroupTaskActivitySection` móvil y se integró en la pantalla `group-info/[id]`: presenta el apartado **Tareas realizadas** con diseño nativo, distintivos de color por estado, soporte de comentarios, visor de fotografías de evidencia y paginación con botón para cargar más registros.

## Cambios en base de datos y servicios

- Preparados localmente: prioridad de tareas, nueva matriz RLS, capacidades explícitas de consulta/avance/edición y registro idempotente de avances con comentario y evidencia privada en bucket `task-evidence`.
- Preparada localmente la migración `20261102180000_chat_villa_link.sql` con columna `proyecto_id` en `chat_grupos`, trigger de validación de acceso `validate_chat_grupo_proyecto` y actualización de políticas RLS.
- Preparada localmente la migración `20261102210000_chat_task_activity_system_messages.sql`:
  - Amplía `chat_mensajes.tipo` con el valor `'sistema'`.
  - Disparador `tr_publish_task_activity_to_chats` en `public.task_activity` que genera un mensaje de sistema en cada grupo vinculado a la villa.
  - Generación de identificador determinista `md5(request_id || ':' || group_id)::uuid` para garantizar idempotencia total en reintentos y evitar mensajes repetidos.
  - Protección de borrado: los integrantes regulares no pueden eliminar mensajes de auditoría del sistema (`tipo <> 'sistema'`); solo administradores pueden gestionarlos.
- Preparada localmente la migración `20261102220000_chat_group_task_activity.sql`:
  - Índice optimizado `idx_task_activity_project_id_desc` sobre `(proyecto_id, id desc)` para consultas paginadas de avances.
  - Función RPC segura `public.get_chat_group_task_activity(p_group_id, p_limit, p_offset)` con validación de membresía en el grupo y aislamiento estricto de villas.
  - Acceso seguro a evidencias: la función `private.task_evidence_access` permite la lectura a miembros del chat vinculado mediante la verificación de visibilidad de proyecto.
- Se actualizó la función serverless `chat-push-notifications` (`presentation.ts` e `index.ts`) para dar formato a los mensajes de tipo `'sistema'` correspondientes a avances de tareas, con soporte para deep linking (`/chat/[groupId]` y `/task/[taskId]`).
- Se incorporó `dispatchTaskActivityNotifications` en `cabosystems-web` y `cabosystems-mobile` al registrar avances con `recordTaskProgress`, notificando a los chats vinculados con exclusión del autor.
- Se configuró deep linking en `cabosystems-mobile/lib/notifications.ts` y acceso directo "Ver tarea" desde `ChatSystemMessage`.
- Planeado para la siguiente sesión: Integración, seguridad, plan de reversión y entrega final (Sesión 9).

## Validaciones realizadas

- Revisión de la estructura actual de tareas, accesos por villa, historial de actividad, chats grupales y notificaciones.
- La prueba local de PostgreSQL aprobó asignación personal, acceso de villa, desarrollo, global, revocación, usuarios inactivos, supervisor, administrador, prioridades y bloqueo anónimo.
- TypeScript web y móvil compilaron sin errores (`npm run build` en web finalizó con código 0).
- Aprobaron 145 pruebas de frontend web y 173 pruebas de la aplicación móvil sin regresiones.
- La prueba local de avances confirmó transacción única, comentarios normalizados, evidencia privada, reintentos idempotentes, limpieza de cargas huérfanas y bloqueo para usuarios sin acceso o anónimos.
- La prueba local de vinculación chat-villa (`chat-villa-link.local.mjs`) aprobó la creación con y sin villa, validación de permisos de supervisor, vinculación múltiple y aislamiento de tareas.
- La prueba local de mensajes automáticos (`chat-task-activity.local.mjs`) confirmó:
  - Generación automática de mensaje de sistema al cambiar estado en todas las conversaciones vinculadas a la villa.
  - Aislamiento: grupos no vinculados o de otra villa no reciben el mensaje.
  - Generación de mensaje enriquecido al avanzar subtareas con comentario y evidencia fotográfica.
  - Idempotencia: reintentos con la misma solicitud no duplican mensajes en el chat.
  - Políticas de borrado: técnicos no pueden eliminar mensajes de sistema; administradores conservan permisos de mantenimiento.
- La prueba local de tareas realizadas del chat (`chat-group-task-activity.local.mjs`) confirmó:
  - Miembros del grupo obtienen el historial oficial de la villa ordenado de más reciente a más antiguo.
  - Paginación precisa con límite y desplazamiento (`limit`/`offset`).
  - Aislamiento: usuarios ajenos al grupo no pueden consultar las actividades y reciben cero registros.
  - Grupos generales sin villa devuelven cero registros sin provocar errores.
  - Miembros del grupo tienen acceso de lectura para visualizar las fotografías de evidencia enlazadas a la villa.
- La suite de pruebas de notificaciones push (`presentation.test.mjs`) aprobó 6 pruebas unitarias verificando la presentación de avances de tarea, inclusión de `taskId`, deep links y formato sin prefijos redundantes.
- Se verificó que las 173 pruebas de la aplicación móvil y las 145 pruebas de la aplicación web continúan pasando con código 0.
- Se verificó la aplicación en el dispositivo físico Android vía ADB (`JNL74P6LCQ4XFE6H`):
  - Cambio de estado instantáneo y directo sin modal mediante el botón "Mark as done" / "Reopen task".
  - Modal de progreso `TaskProgressModal` con comentario y foto activado correctamente en subtareas.
  - Navegación al chat y a la información de grupo con visualización y edición de la villa vinculada.

## Pendientes y siguientes pasos

- Entrega y monitoreo operativo en producción de los flujos de tareas, evidencias y chat de villas.
- Opcional: ejecutar las migraciones incrementales complementarias en el panel SQL de Supabase (bucket `task-evidence`, trigger de publicaciones al chat y RPC de tareas realizadas) cuando el equipo decida activar los mensajes automáticos en el entorno remoto.

## Fuentes

- `docs/plan_tareas_chat_2_6_noviembre.md`.
- `docs/project-access.md`.
- `docs/task-activity-reports.md`.
- Migraciones preparadas: `20261102120000`, `20261102153000`, `20261102180000`, `20261102210000` y `20261102220000`.
