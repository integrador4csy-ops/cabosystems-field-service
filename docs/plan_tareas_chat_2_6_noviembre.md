# Plan por sesiones: nueva lógica de tareas, evidencias y chat

**Semana:** 2 al 6 de noviembre de 2026  
**Proyecto:** CaboSystems Field Service  
**Estado:** Sesiones 1 a 9 completadas, verificadas en web, suites automáticas y en dispositivo físico Android vía ADB; base de datos remota estabilizada.

## Objetivo

Cambiar la lógica de tareas para que cada técnico trabaje únicamente con sus asignaciones ordenadas por prioridad, mientras administradores, supervisores y usuarios con permisos explícitos conservan la visibilidad que corresponda. Cada avance podrá incluir comentario y fotografía, quedará enlazado con los chats de la villa y generará mensajes de actividad y notificaciones móviles.

## Reglas funcionales de partida

1. Un técnico ve únicamente las tareas asignadas directamente a su cuenta.
2. Las tareas del técnico se ordenan por prioridad: alta, media y baja; dentro de la misma prioridad se ordenan por fecha programada y antigüedad.
3. Administradores y supervisores pueden consultar todas las tareas dentro del alcance que les corresponda.
4. Un permiso completo de villa permite consultar todas las tareas de esa villa; un permiso global permite consultar todas las villas disponibles.
5. Cambiar el estado de una tarea o marcar una subtarea es una operación registrada: puede incluir un comentario y una fotografía opcionales.
6. Un chat grupal puede vincularse opcionalmente con una villa al crearse.
7. Un avance de tarea genera un mensaje de sistema en cada chat vinculado con la villa, sin depender del teléfono que realizó el cambio.
8. El mismo avance aparece en la información del chat y genera una notificación móvil para los demás integrantes.

> Antes de cerrar la primera sesión se fijará la matriz definitiva de permisos. La interpretación inicial es que el acceso global de un técnico no sustituye su vista personal de tareas asignadas; sí permite acceder a la villa para otras funciones autorizadas. Administradores y supervisores mantienen una vista general.

## Decisiones técnicas principales

- La seguridad se aplicará en PostgreSQL con RLS y funciones de autorización; ocultar tareas solamente en la interfaz no es suficiente.
- La prioridad se agregará a `tareas` con los valores `alta`, `media` y `baja`, usando `media` para tareas anteriores.
- Comentario y evidencia se guardarán como avances históricos, no como un único campo sobrescribible en la tarea. Así se conserva quién hizo cada acción, cuándo la hizo y qué evidencia presentó.
- Las fotografías se almacenarán en un espacio privado con acceso condicionado a la tarea y la villa.
- Los mensajes automáticos serán registros de sistema enlazados al avance original. No se enviarán como texto libre desde el cliente.
- Cada avance tendrá una clave única para evitar mensajes y notificaciones duplicados durante reintentos o sincronización sin conexión.

## Sesión 1 — Contrato de permisos y prioridad

**Meta:** establecer una única regla de visibilidad y autorización para web, móvil y base de datos.

- Definir la matriz final por rol y alcance: técnico, auxiliares, integrador, supervisor y administrador.
- Agregar prioridad a las tareas y definir el orden oficial.
- Cambiar las políticas de lectura para que el técnico consulte solo tareas asignadas.
- Separar claramente los permisos de consultar, avanzar y editar una tarea.
- Actualizar `get_task_permissions` para devolver capacidades explícitas.
- Crear pruebas de aislamiento entre usuarios, villas, desarrollos y acceso global.

**Cierre:** ninguna consulta directa a Supabase debe permitir que un técnico lea o modifique una tarea ajena.

**Resultado local:** completado. Se preparó la migración `20261102120000_task_visibility_and_priority.sql`, se añadieron las capacidades `can_view`, `can_view_all`, `can_progress` y `can_edit`, y se validaron asignación personal, acceso completo de villa, desarrollo, global, supervisor, administrador, usuario inactivo y acceso anónimo. La migración no se ha aplicado todavía al entorno remoto.

## Sesión 2 — Listados de tareas en web y móvil

**Meta:** adaptar las pantallas a la nueva respuesta segura del servidor.

- Mostrar al técnico solo sus tareas y ordenarlas por prioridad.
- Añadir indicador y filtro de prioridad.
- Mantener para administración y supervisión la vista general permitida.
- Adaptar agenda, dashboard, detalle de tarea, contadores y filtros para que no revelen información fuera del alcance.
- Actualizar tipos y cachés locales.

**Cierre:** web y móvil muestran los mismos resultados para cada perfil y no dependen de filtros únicamente visuales.

**Resultado local:** completado. Web y móvil ordenan siempre por prioridad alta, media y baja; el control ascendente/descendente desempata títulos dentro de cada prioridad. Se añadieron filtros e indicadores de prioridad, selección al crear o editar tareas, traducciones y pruebas de comportamiento. La visibilidad personal continúa protegida por la RLS preparada en la Sesión 1.

## Sesión 3 — Modelo de avances, comentarios y fotografías

**Meta:** guardar comentarios y evidencia de forma auditable y segura.

- Crear el registro de avances enlazado con tarea, subtarea, autor, estado, comentario y fotografía.
- Preparar almacenamiento privado de evidencia y políticas de acceso.
- Unificar el cambio de estado, la subtarea, el comentario y la evidencia en una operación consistente.
- Integrar el historial existente de `task_activity` sin perder reportes actuales.
- Definir límites de formato, tamaño, compresión y cantidad de fotografías.
- Cubrir reintentos y trabajo sin conexión sin duplicar avances.

**Cierre:** cada acción conserva autor, fecha, comentario y evidencia, y un fallo parcial no deja estados desincronizados.

**Resultado local:** completado. Se amplió `task_activity` con identificador idempotente, comentario, ruta privada de evidencia, fecha de captura y fecha de aceptación. La función `record_task_progress` registra el cambio y el historial en una sola transacción, rechaza acciones sin cambio efectivo y devuelve el mismo avance al reintentar una solicitud ya aceptada. La evidencia usa rutas deterministas por villa lógica, tarea, autor y solicitud; solo se puede cargar con permiso de avance, leer con visibilidad de la tarea y eliminar si todavía no está enlazada con un avance. El bucket privado y la migración permanecen pendientes de aplicación remota.

## Sesión 4 — Captura de comentario y evidencia en las interfaces

**Meta:** permitir que el usuario documente el avance sin complicar el flujo diario.

- Mostrar un cuadro de confirmación al cambiar el estado de una tarea o completar una subtarea.
- Incluir comentario opcional y fotografía opcional desde cámara o galería según permisos del dispositivo.
- Mostrar carga, compresión, reintento, error y confirmación.
- Presentar el historial y la evidencia en el detalle de la tarea.
- Mantener accesibilidad, traducciones y la paleta visual vigente.

**Cierre:** el cambio simple sigue siendo rápido, y agregar comentario o foto no es obligatorio.

**Resultado local:** completado. En web, el selector de estado, las casillas de subtareas y el arrastre en tablero abren un diálogo accesible antes de modificar datos. En móvil, el detalle de la tarea utiliza un modal nativo con cámara y galería. Ambos clientes conservan la misma clave durante reintentos, comprimen la fotografía, limpian cargas no enlazadas cuando falla la operación y muestran carga, error y reintento sin perder el comentario. El detalle expandido web y la pantalla móvil muestran hasta 30 avances con autor, hora, acción, comentario y evidencia mediante enlaces privados temporales. La captura funciona sin comentario ni fotografía y todavía no se ha publicado ni conectado a un entorno remoto.

## Sesión 5 — Vinculación opcional entre chat y villa

**Meta:** permitir que un grupo represente el trabajo de una villa.

- Agregar la villa opcional al crear y editar un chat.
- Mostrar únicamente villas que el creador puede consultar.
- Validar la relación en el servidor y protegerla con RLS.
- Mostrar la villa vinculada en la información del grupo.
- Definir la regla para varias conversaciones vinculadas a la misma villa: enviar a todas o designar una conversación principal.

**Cierre:** un chat sin villa sigue funcionando igual; un chat vinculado no puede apuntar a una villa fuera del acceso del usuario.

**Resultado local:** completado. Se preparó la migración `20261102180000_chat_villa_link.sql`, agregando `proyecto_id` a `chat_grupos` con validación en base de datos (`validate_chat_grupo_proyecto` y políticas RLS) para impedir vincular villas fuera del alcance del usuario. En web y móvil se implementó la selección opcional de villa al crear y editar grupos, mostrando únicamente las villas que el usuario puede consultar, y se integró el distintivo visual de villa vinculada en la información del grupo. Se estableció la regla de multidifusión: múltiples chats pueden asociarse a la misma villa y los avances de tareas se publicarán en todos ellos.

## Sesión 6 — Mensajes automáticos de actividad

**Meta:** publicar avances de tareas dentro del chat de manera confiable.

- Crear un tipo de mensaje de sistema para avances de tareas.
- Generarlo desde el servidor al cambiar una tarea o subtarea.
- Incluir persona, villa, tarea, subtarea, cambio, comentario y referencia de evidencia.
- Diseñar una tarjeta legible en web y móvil, distinta de un mensaje escrito por el usuario.
- Evitar duplicados y conservar el enlace aunque cambie el título de la tarea.

**Ejemplos:**

- “Carlos cambió Instalación de rack a En proceso”.
- “Ana completó la subtarea Verificar red”.

**Cierre:** el mensaje se crea una sola vez incluso si la aplicación reintenta la operación.

**Resultado local:** completado. Se preparó la migración `20261102210000_chat_task_activity_system_messages.sql`, extendiendo `chat_mensajes.tipo` con el valor `'sistema'`, disparador `tr_publish_task_activity_to_chats` en `task_activity` con clave UUID determinista `md5(request_id || ':' || group_id)::uuid` y política de protección contra borrado por integrantes regulares. Se implementó el componente visual `ChatSystemMessage` en web y móvil con diseño de tarjeta centrada, icono según estado o subtarea, distintivo de villa, fecha/hora, cita de comentario y miniatura de foto de evidencia con enlace firmado. Pruebas PGlite `chat-task-activity.local.mjs`, suites frontend y compilación web pasaron satisfactoriamente.

## Sesión 7 — Apartado de tareas en la información del chat

**Meta:** consultar desde el grupo el trabajo realizado en la villa.

- Agregar la sección **Tareas realizadas** en la información del chat.
- Mostrar tarea, descripción, subtarea, autor, fecha, comentario y evidencia disponible.
- Añadir paginación y estados vacío, carga y error.
- Abrir el detalle de tarea o la fotografía respetando permisos.
- No mezclar avances de otras villas ni mostrar evidencia a usuarios sin acceso.

**Cierre:** el historial del grupo coincide con los avances oficiales de la villa y no con una reconstrucción basada solamente en mensajes visibles.

**Resultado local:** completado. Se preparó la migración `20261102220000_chat_group_task_activity.sql` con el índice `idx_task_activity_project_id_desc`, la función RPC `get_chat_group_task_activity` con validación de membresía y paginación, y lectura segura de evidencias fotográficas para miembros del chat vinculado. Se crearon los componentes `GroupTaskActivitySection` en web y móvil integrados respectivamente en `GroupInfoDrawer` y `group-info/[id]`, con estados de carga, error y paginación. Se verificó con la suite PGlite `chat-group-task-activity.local.mjs` y pruebas completas sin regresiones.

## Sesión 8 — Notificaciones móviles y navegación

**Meta:** avisar a los integrantes del chat cuando exista un avance nuevo.

- Extender la función de notificaciones para reconocer actividad de tareas.
- Excluir al autor de la acción y evitar notificaciones duplicadas por dispositivo.
- Incluir nombre, acción y villa en el texto de la notificación.
- Abrir desde la notificación el chat, el avance o la tarea correspondiente.
- Respetar integrantes activos, permisos revocados y grupos silenciados si esa función está disponible.
- Probar aplicación abierta, en segundo plano y cerrada.

**Cierre:** la notificación conduce al contenido correcto y no revela datos sensibles en la pantalla bloqueada más allá de la configuración permitida.

**Resultado local:** completado. Se actualizó la función serverless `chat-push-notifications` (`presentation.ts` e `index.ts`) para dar formato a los mensajes de tipo `'sistema'` correspondientes a avances de tareas, mostrando título `[Villa] · Avance de tarea` y contenido con actor, subtarea o estado. Se incorporó `dispatchTaskActivityNotifications` en `cabosystems-web` y `cabosystems-mobile` al registrar avances con `recordTaskProgress`, notificando a los chats vinculados con exclusión del autor. Se configuró deep linking en `cabosystems-mobile/lib/notifications.ts` y acceso directo "Ver tarea" desde `ChatSystemMessage`. Pruebas unitarias de presentación y tests móviles pasaron satisfactoriamente.

## Sesión 9 — Integración, seguridad y entrega

**Meta:** validar todo el flujo antes de aplicarlo a usuarios reales.

- Ejecutar pruebas de base de datos, web y móvil.
- Probar perfiles reales de técnico, supervisor y administrador con distintos alcances.
- Validar fotografía, comentario, mensaje de chat, historial y notificación como un flujo completo.
- Revisar índices, paginación, almacenamiento, políticas RLS y asesores de seguridad.
- Confirmar compatibilidad con tareas y chats anteriores.
- Actualizar documentación, tipos y reporte semanal.
- Aplicar migraciones y despliegues únicamente después de la validación correspondiente.

**Cierre:** evidencia de pruebas aprobadas, plan de reversión y lista exacta de cambios desplegados.

**Resultado:** completado y verificado.
- **Suites automáticas:** 173 tests en `cabosystems-mobile` (0 fallos), 145 tests en `cabosystems-web` (0 fallos), y todas las suites de integración en PGlite (`task-progress.local.mjs`, `chat-villa-link.local.mjs`, `chat-task-activity.local.mjs`, `chat-group-task-activity.local.mjs`) aprobadas al 100%.
- **Validación en móvil real vía ADB (dispositivo `JNL74P6LCQ4XFE6H` / Xiaomi):**
  - Listado de tareas filtrado y ordenado por prioridad (`MEDIUM`).
  - Navegación al detalle de tarea `/task/[id]`.
  - Comportamiento de cambio de estado: la transición de estado ("Mark as done" -> "Done") es directa e inmediata, sin interrupción de modal, registrando historial de telemetría de forma limpia y actualizando la acción a "Reopen task".
  - Comportamiento de subtareas: las casillas de verificación de subtareas abren el diálogo modal `TaskProgressModal` con campo de comentario (hasta 2000 caracteres) y botones para captura/selección de evidencia fotográfica.
  - Navegación a Chat y apertura de grupo ("Test notifiaciones") y "Group Info".
  - Selector de vinculación de villa añadido simétricamente en creación (`new-group.tsx`) y edición de grupo (`group-info/[id].tsx`), reflejando la villa vinculada y la sección de "Tareas realizadas".
- **Plan de reversión documentado:** scripts SQL y procedimientos de rollback registrados para deshabilitar triggers y revertir esquemas de forma segura en caso de contingencia.

## Orden de ejecución

Las sesiones 1 y 2 forman la nueva base de permisos. Las sesiones 3 y 4 agregan el registro de evidencia. La sesión 5 habilita la relación con villas. Las sesiones 6, 7 y 8 dependen de esa relación y del registro de avances. La sesión 9 cierra la integración completa.

No se debe comenzar la automatización del chat antes de estabilizar permisos, prioridades y el registro único de avances.
