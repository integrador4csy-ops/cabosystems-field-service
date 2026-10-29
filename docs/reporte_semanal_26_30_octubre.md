# Reporte semanal: 26 al 30 de octubre de 2026

**Proyecto:** CaboSystems Field Service  
**Corte:** 29 de octubre de 2026. No incluye actividades futuras del 30.

**1. Mejoras de la agenda y los calendarios**

- Se mejoró la navegación móvil entre mes, semana y día, con transiciones por deslizamiento.
- Se incorporó la preparación de periodos vecinos y el guardado de calendarios consultados para reducir esperas y recuperar información sin conexión.
- Se agregó la personalización de colores por usuario en web y móvil, sin modificar los colores originales de Google.
- Se ajustó la presentación de nombres de calendarios para facilitar su identificación.

**2. Optimización de la aplicación móvil y el chat**

- Se trabajó en la carga de pantallas, listas de personal y conversaciones, reduciendo trabajo en pantallas inactivas.
- Se mejoró el gesto para responder mensajes en el chat móvil.
- Se incorporó la precarga de emojis en la web para reducir la espera al mostrarlos.
- Continúa la revisión de la carga inicial de las pestañas.

**3. Registro de entradas y salidas sin conexión**

- Se implementó el guardado local de entradas y salidas con fotografía, ubicación y hora de captura.
- Se agregó sincronización al recuperar conexión con la app activa, con reintentos y protección contra registros duplicados.
- Se mejoró el procesamiento de fotografías y la obtención de ubicación real.
- Los registros pendientes se conservan por cuenta y permanecen guardados al cerrar la app.

**4. Actualización de permisos de tareas y subtareas**

- Los colaboradores con acceso a una villa pueden actualizar estados y marcar subtareas dentro de su alcance autorizado.
- El encargado asignado identifica al responsable de la tarea; los permisos dependen del acceso a la villa.
- Se conservaron las restricciones para editar contenido, reasignar o eliminar tareas según el rol y acceso del usuario.

**5. Implementación de informes de actividad**

- Se incorporó un historial de cambios de estado y avances de subtareas, con la persona que realizó la acción y la fecha.
- Se desarrolló el informe web con filtros por periodo, colaborador y villa.
- Se agregó vista previa y descarga de informes en PDF y Excel.
- Se conserva el historial aunque posteriormente cambien nombres o responsables de las tareas.

**6. Creación de tablas y almacenamiento local**

- `agenda_calendar_colors`: tabla nueva para guardar el color elegido por cada usuario para sus calendarios, con acceso limitado a su propia cuenta.
- `task_activity`: tabla nueva para guardar el historial de avances de tareas y subtareas, incluyendo fecha, autor, villa, tarea y cambio realizado. Los usuarios consultan únicamente la actividad de las villas a las que tienen acceso.
- SQLite en la app móvil: almacenamiento local de operaciones pendientes y sus referencias de fotografías para sincronizarlas al recuperar conexión.

**7. Modificaciones en tablas y reglas de la base de datos**

- `google_calendar_connection`: se agregó el campo `calendar_aliases` para guardar nombres de presentación de los calendarios.
- `tareas` y `subtareas`: se actualizaron las políticas de acceso y las funciones de validación para permitir registrar avances según el acceso a la villa, conservando las restricciones de edición.
- `tareas`: se eliminó la regla automática que agregaba al encargado como participante de la villa. La participación se administra explícitamente desde el equipo de la villa.
- `tareas` y `subtareas`: se añadieron disparadores para registrar automáticamente los cambios efectivos de avance en `task_activity`.
- `task_activity`: se agregaron índices para consultar por fecha, colaborador y villa, además de reglas que impiden modificar el historial directamente desde la aplicación.

**8. Validaciones y pendientes**

- La documentación de informes registra 138 pruebas web aprobadas, compilación correcta y verificación de descargas con datos ficticios.
- Se documentaron pruebas móviles de sincronización, permisos y revisión de tipos. No se ejecutaron nuevamente al redactar este reporte.
- Queda pendiente validar el funcionamiento completo en un teléfono con una nueva compilación nativa y medir el rendimiento real.
- El historial registra actividad desde su activación; no reconstruye acciones anteriores. Para operaciones sin conexión toma la fecha de aceptación en el servidor.

Fuentes: docs/company-agenda.md, docs/mobile-optimization.md, docs/task-activity-reports.md y migraciones del 27 al 29 de octubre. El reporte se guarda localmente; no acredita publicación web, entrega de APK ni respaldo de todos los cambios en GitHub. Se excluyen como novedades las funciones documentadas con fecha del 23 de octubre.
