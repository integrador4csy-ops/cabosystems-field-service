# Integración de la agenda con Google Calendar

Actualizado el 20 de octubre de 2026. **Estado: conexión OAuth, selección y consulta/gestión directa de eventos implementadas en web y móvil. Tres funciones desplegadas en Supabase. El usuario confirmó la lectura de un evento real en web.**

## Alcance confirmado por el usuario

- Sincronizar cambios en ambos sentidos.
- El coordinador/admin administra eventos y tiene varios calendarios identificados por integrante, además de Oficina, según la referencia compartida.
- El usuario confirmó que la cuenta del coordinador puede crear y editar eventos en todos esos calendarios. Los permisos efectivos se comprobarán al conectar Google.
- La organización por calendario debe conservarse. La imagen no confirma propiedad ni identificadores de Google.
- Google Calendar API ya está habilitada, según la captura compartida. El usuario agregó su propio correo como usuario de prueba y confirmó la selección de los permisos `calendar.calendarlist.readonly` y `calendar.events`. Las primeras pruebas usarán su cuenta; la del coordinador se autorizará posteriormente.
- Se mantienen los permisos actuales de la agenda: administradores y supervisores activos gestionan; el resto de colaboradores activos consulta la agenda general. No se ha solicitado convertir los calendarios en agendas privadas por usuario.

## Confirmaciones pendientes

1. Autorizar posteriormente la cuenta del coordinador y seleccionar explícitamente sus calendarios de empresa.
2. Verificar operaciones de creación, edición y eliminación contra un calendario de pruebas real, y verificar móvil en dispositivo físico. Las escrituras se probaron con respuestas de Google simuladas; no se modificaron eventos del usuario durante la implementación.

## Configuración inicial en Google Cloud

1. Entrar en [Google Cloud Console](https://console.cloud.google.com/) con una cuenta autorizada para administrar el proyecto de la empresa. Revisar primero si ya existe el proyecto del identificador Google usado por móvil; reutilizarlo si corresponde a CaboSystems y tienen acceso. Si no hay uno apropiado, crear un proyecto llamado CaboSystems Field Service.
2. Dentro del proyecto seleccionado, abrir **APIs y servicios → Biblioteca**, buscar **Google Calendar API** y habilitarla.
3. Abrir **Google Auth Platform → Branding** y configurar el nombre CaboSystems Field Service, correo de soporte y contacto.
4. En **Audience**, usar Internal solo si la cuenta pertenece a una organización Google Workspace y el proyecto admite ese uso. Si se usa External para pruebas, agregar la cuenta del coordinador a Test users.
5. Crear un cliente OAuth de tipo Web application llamado CaboSystems Calendar. Para el flujo de servidor, dejar vacíos los orígenes JavaScript y registrar como URI de redirección `https://nyqlfgnblkmijxspkvpi.supabase.co/functions/v1/google-calendar-callback`. Esta función ya está desplegada. Es independiente del callback de login de Supabase.
6. En Supabase → Edge Functions → Secrets, guardar `GOOGLE_CALENDAR_CLIENT_ID` y `GOOGLE_CALENDAR_CLIENT_SECRET` con los valores originales del cliente de Google. No enviarlos en el chat ni agregarlos a archivos públicos o al repositorio. El usuario ya confirmó la corrección de nombres y el servidor reconoce la presencia de configuración. La columna DIGEST de Supabase es una huella, no el valor que debe copiarse.

No basta con una API key para acceder a calendarios privados: la cuenta del coordinador debe autorizar el acceso mediante OAuth. Habilitar la API no importa ni cambia eventos por sí solo.

## Conexión implementada

- Botón Google Calendar en la agenda web, visible solo para administradores activos. Supervisores mantienen la gestión de eventos, sin configurar la cuenta de empresa.
- `google-calendar` es una API autenticada; vuelve a validar el JWT con Auth y el perfil canónico. Ofrece estado de conexión, inicio de OAuth, lista paginada y guardado de selección. No devuelve tokens ni ciphertexts al cliente.
- `google-calendar-callback` recibe el retorno de Google sin JWT de Supabase. Su autenticación se basa en un estado aleatorio, almacenado como SHA-256, con vencimiento de diez minutos y consumo atómico de un solo uso, junto con PKCE S256. Revalida que el administrador siga activo antes de guardar.
- Credencial renovable y verificador cifrados con AES-256-GCM y propósito autenticado. La clave se deriva con HKDF del secreto de Google y el identificador del cliente. Cambiar el secreto o cliente requiere reconectar Calendar; no afecta a los eventos de agenda existentes.
- La conexión es única para la empresa. Revisiones optimistas impiden que autorizaciones o selecciones simultáneas sobrescriban la conexión actual. Cambiar la cuenta exige confirmación en la interfaz y limpia su selección.
- Ningún calendario se selecciona automáticamente. Los calendarios con rol Google `owner` o `writer` permiten lectura y escritura. Los de rol `reader` o `writerWithoutPrivateAccess` se pueden seleccionar para consulta, sin edición. Los de rol `freeBusyReader` se pueden seleccionar y se consultan mediante `freeBusy.query`: se muestran bloques Ocupado, sin títulos, ubicaciones ni detalles privados. El ámbito adicional `calendar.events.freebusy` requiere volver a autorizar las conexiones anteriores. Los bloques de disponibilidad son de consulta y no son eventos editables; los horarios no ocupados se dejan vacíos. Las respuestas con errores no se interpretan como disponibilidad libre. El servidor comprueba los permisos actuales de Google antes de cada escritura, y los formularios solo ofrecen calendarios editables para crear eventos.
- Al terminar la autorización, cerrar la pestaña de retorno y pulsar Actualizar en Agenda → Google Calendar. Luego consultar calendarios, seleccionar el de pruebas y guardar.
- Guardar la selección permite consultar los eventos de esos calendarios al actualizar la agenda. La selección no crea, edita ni elimina eventos por sí misma.

La migración `20261020185353_google_calendar_connection.sql` está aplicada y alineada con el historial remoto. Crea `google_calendar_connection` y `google_calendar_oauth_states`: ambas con RLS habilitado, sin políticas para clientes y sin privilegios para `anon` o `authenticated`; únicamente el servidor puede leerlas. Se verificaron estos permisos en el proyecto real. El asesor señala dos avisos informativos de RLS sin políticas: es intencional en estas tablas exclusivas del servidor ([referencia del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Los avisos de funciones heredadas ya estaban presentes antes de esta migración.

Verificación: veintiuna pruebas de servidor, incluidas cifrado, autorización, vencimiento, repetición de callbacks, revocación de administrador, paginación, conflictos de conexión, privilegios PostgreSQL, colores y conversión entre eventos con hora y Todo el día. Las operaciones de escritura se probaron con respuestas simuladas de Google. Comprobación estática del servidor, compilación web y pruebas móviles completadas. El usuario completó OAuth y selección con su cuenta y confirmó que el evento «Hola bro, 10am» ya aparece en la web después de desplegar la función de eventos. Esta confirmación verifica lectura real; no se declara verificada una escritura real.

## Comportamiento de los eventos

`google-calendar-events` es una API autenticada para colaboradores activos. Consulta los calendarios seleccionados directamente en Google por el periodo visible, con paginación y hasta cuatro consultas concurrentes. Google expande las series y sus excepciones mediante `singleEvents=true`. La agenda combina esos resultados con los registros de `agenda_eventos`; no copia eventos Google a otra tabla. Conserva identidad por calendario y evento, etiqueta el origen y permite buscar por nombre del calendario.

La conexión de empresa se administra desde web; web y móvil usan la misma función de eventos. Los técnicos no necesitan conectar individualmente sus cuentas para consultar la agenda general. Administradores y supervisores activos pueden escribir; los demás perfiles activos solo consultan. Se vuelve a validar el perfil y la revisión de la conexión antes de escribir. Google aplica además sus permisos efectivos.

Al crear un registro se elige «Solo CaboSystems» o uno de los calendarios Google seleccionados. Los registros locales anteriores permanecen locales: no se exportan automáticamente ni se permite moverlos implícitamente durante una edición. Los cambios sobre eventos Google se guardan directamente en Google y quedan visibles en su calendario original. Las altas usan un identificador estable por formulario y una huella del contenido para evitar duplicados al reintentar. Ediciones y eliminaciones exigen la versión ETag mostrada; si Google cambió el evento, se informa el conflicto y se pide actualizar.

Las fechas con hora se presentan y editan en `America/Mazatlan` (Los Cabos). Los eventos de todo el día conservan fechas sin conversión UTC y su final exclusivo en Google. Los de varios días aparecen en cada día visible que ocupan. Los formularios solicitan inicio y fin o Todo el día, y Google conserva además fecha final. Editar solo texto conserva los segundos, la zona y duración exactos del evento original. Alternar entre Todo el día y un horario elimina explícitamente los campos date o dateTime anteriores en la petición PATCH. El servidor conserva el fin predeterminado de una hora para clientes anteriores, pero los nuevos formularios solicitan fin explícito.

El fondo de las tarjetas se obtiene de `CalendarList.backgroundColor` de la cuenta conectada, con lectura fresca al consultar eventos. No requiere volver a seleccionar calendarios cuando cambia su color. Se valida el formato hexadecimal y se elige texto negro o blanco automáticamente según el contraste. Los registros locales mantienen la paleta de CaboSystems y ahora guardan su propia hora final mediante la migración `20261020195404`.

Los nuevos eventos Google admiten repetición por días, semanas y meses. La regla mensual conserva el ajuste al último día de meses cortos de CaboSystems, mediante `BYMONTHDAY` y `BYSETPOS=-1`. El tipo unificado evento se guarda como metadato privado; los valores históricos se presentan también como eventos. Las series Google existentes se muestran expandidas; editar o eliminar afecta solo la ocurrencia y se explica en el formulario. La regla o serie completa se administra en Google. Los tipos especiales o bloqueados son de consulta. No se alteran asistentes ni alarmas existentes; los nuevos registros no añaden alarmas ni asistentes. Google Tasks no forma parte de Calendar API ni de este alcance.

La consulta directa sustituye la propuesta inicial de mantener una copia con `syncToken`, cola y suscripciones. No se necesita replicar ni resolver versiones entre dos bases para los eventos de Google. No hay notificaciones push de cambios de Google: la web actualiza con su botón Actualizar, al recuperar foco y al cerrar la configuración; móvil al enfocar la pestaña, recuperar la app o deslizar para actualizar. Las escrituras requieren conexión y confirmación remota. Si una consulta falla, se informa; no se presenta como un calendario vacío confirmado.

## Límites de esta entrega

- No se ha publicado el frontend ni instalado una versión móvil nueva. El código está en el repositorio local; las funciones sí están desplegadas.
- Pendientes las pruebas físicas de móvil y escrituras reales en el calendario de pruebas. La lectura web real fue confirmada por el usuario.
- No se editan reglas completas de series Google, invitados, conferencias, tipos especiales ni calendarios de solo consulta.
- La configuración sigue en modo de prueba de Google. La cuenta del coordinador se autorizará después.

## Referencias oficiales revisadas

- [Lista de calendarios y permisos de acceso](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list).
- [OAuth para aplicaciones de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).
- [Sincronización incremental](https://developers.google.com/workspace/calendar/api/guides/sync).
- [Eventos recurrentes](https://developers.google.com/workspace/calendar/api/guides/recurringevents).
