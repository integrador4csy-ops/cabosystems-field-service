# Reporte semanal de actividades: 19 al 23 de octubre de 2026

**Proyecto:** CaboSystems Field Service  
**Última actualización:** 22 de octubre de 2026  
**Corte:** incluye los avances registrados hasta el 21 de octubre. El día 22 se actualizó este reporte; no se anticipan trabajos del día 23.

## Agenda general de la empresa

- Se separó la agenda del calendario de tareas. Ahora usa `agenda_eventos` para eventos y recordatorios generales, sin depender de villa o proyecto.
- Inicialmente se incorporó la selección Evento / Recordatorio. Posteriormente se unificaron los registros como eventos, conservando la repetición semanal con días de lunes a domingo, mensual y personalizada, con fecha final opcional. Las tarjetas identifican la repetición con un icono.
- Administradores y supervisores de instalación activos pueden crear, editar y eliminar; los demás colaboradores activos consultan. La base de datos aplica estos permisos.
- Las migraciones de agenda y repetición están aplicadas en Supabase. Las tareas existentes conservan sus datos.
- La agenda web ofrece mes, semana, día, búsqueda y selección de calendarios mediante filtros con su color correspondiente.
- La vista semanal web conserva el diseño por columnas. Los eventos Google usan el color real de su calendario como fondo, con texto contrastante. Las tarjetas muestran inicio y fin o Todo el día; los formularios web y móvil incluyen esas opciones. La migración de hora final está aplicada, conservando los registros anteriores sin duración inventada. Revisión en navegador con datos ficticios y guardado de un rango horario local.
- La versión móvil usa la misma agenda, con formularios, repeticiones, actualización en tiempo real y consulta de la última información guardada por usuario y periodo cuando falla la conexión.
- Se rediseñó la pestaña móvil. El último ajuste recupera la cabecera compartida con el logo y muestra en blanco el número del día seleccionado, usando el color corporativo definido en el tema.
- Los recordatorios son visibles en el calendario; no se agregaron avisos automáticos.

Detalle técnico y limitaciones: [Agenda de la empresa](company-agenda.md).

## Validación realizada

- Web: 55 pruebas, incluidas veintiuna de Google Calendar y dos de presentación de colores y horarios; se verificaron también las restricciones de hora final en PostgreSQL. Compilación completada correctamente.
- Móvil: 20 pruebas de agenda y verificación de TypeScript completadas correctamente; se verifica también el enrutamiento de eventos Google en web y móvil.
- Se generó correctamente el paquete JavaScript para Android. Esto no equivale a crear, instalar ni publicar un APK.
- Queda pendiente la prueba en un dispositivo físico. La revisión interactiva del formulario en React Native Web se bloqueó al abrir un modal; no se declara completada.

## Entrega en GitHub

Se publicó en `main` el commit `c8960fe193e9f629916bcce57bdc53a109bebdc9`, con el mensaje **Reestructuracion de agenda y tareas**.

Posteriormente se publicó el commit `abea789763b78fca847b15279abe866252263752`, con el mensaje **Implementacion de Google Calendar Api**. Los ajustes posteriores de interfaz y rendimiento continúan como cambios locales. No se afirma una publicación móvil ni un despliegue del frontend.

## Google Calendar: conexión y eventos

El usuario solicitó sincronización en ambos sentidos entre la agenda y Google Calendar. La referencia muestra una cuenta de coordinador con varios calendarios por integrante y uno de Oficina; debe conservarse esa organización, en lugar de tratarla como un solo calendario.

El usuario confirmó que el coordinador puede editar todos los calendarios. Se configuró Google Calendar API, el usuario agregó su correo de pruebas, seleccionó los permisos necesarios y creó un cliente OAuth web. La cuenta del coordinador se autorizará posteriormente.

Se implementaron la autorización segura, la selección y la consulta/gestión de eventos. Las tres funciones y la migración de tablas exclusivas del servidor están desplegadas en Supabase. Incluye PKCE, estado de un solo uso con caducidad, credencial cifrada y comprobaciones canónicas de permisos. La web y móvil consultan los calendarios seleccionados directamente en Google y combinan esos eventos con los registros locales, identificando el origen.

El usuario corrigió los secretos en Supabase, autorizó su cuenta y seleccionó un calendario. Después de incorporar la consulta de eventos, confirmó que «Hola bro, 10am» aparece en la agenda web. Se implementaron altas con reintentos sin duplicados y edición/eliminación con protección ETag, fecha final, horario de Los Cabos, eventos de varios días y recordatorios recurrentes. Las escrituras se probaron con respuestas simuladas de Google; no se modificaron eventos reales durante la implementación. Los eventos locales anteriores no se exportan automáticamente. [Detalle y límites](google-calendar-integration.md).

## Ajustes posteriores al corte del día 20

- Se añadieron colores de fondo por calendario y texto blanco o negro según el contraste. Se retiró el correo de origen de las tarjetas para reducir información repetida.
- Se incorporó un minicalendario lateral para navegar por fechas y se adaptó su despliegue a pantallas pequeñas, junto con los filtros de calendarios.
- Se habilitó la selección de calendarios de solo consulta. Para calendarios que únicamente comparten disponibilidad, se implementó la consulta de intervalos ocupados, sin exponer detalles privados y sin permitir edición.
- Se mejoró el mensaje cuando una autorización anterior no incluye permisos de disponibilidad. Es necesario volver a autorizar y seleccionar los calendarios para probar ese caso con la cuenta real.
- Se mejoró el formulario de eventos: Todo el día desactivado al crear, marca blanca al seleccionarlo y campos de fecha y hora que abren selectores compactos al pulsar todo el campo.
- Se corrigió el fallo que dejaba la pantalla en blanco al crear eventos desde un día en conexiones locales HTTP.
- Se mejoró el formulario de tareas y se ajustó el tamaño y centrado del logo de inicio de sesión.
- Se reemplazó la precarga general al iniciar sesión por una carga prioritaria de la sección abierta y precarga por intención: pasar el cursor, enfocar con teclado o tocar una opción del menú.
- Se incorporó caché en memoria por sesión, reutilización de peticiones pendientes y actualización en segundo plano. La caché se limpia al cerrar sesión y se limita la precarga en conexiones lentas.
- En agenda se conservan periodos consultados y se precargan meses vecinos de forma secuencial; la navegación rápida espera brevemente antes de consultar el periodo final.
- Se retiraron el aviso Updating / Actualizando y el botón de actualización manual de la agenda. Google Calendar se integró en la barra superior; continúa la actualización automática.

### Validación de estos ajustes

- Se completaron las pruebas automatizadas web y la compilación de producción tras los cambios de rendimiento. Se validaron reutilización de peticiones, caducidad de caché, aislamiento entre sesiones y prioridad de precarga.
- Las pruebas de Google Calendar incluyeron acceso de solo consulta y disponibilidad, errores de permisos y bloqueo de escrituras no autorizadas. Se verificó TypeScript en las funciones y en móvil.
- El último ajuste de la barra de agenda se verificó con TypeScript y en navegador con datos ficticios.
- No se midieron todavía los tiempos de navegación con una sesión real autenticada ni se declara validada la mejora en todos los dispositivos.

## Pendientes al corte

1. Probar altas, edición y eliminación en un calendario de pruebas real.
2. Autorizar la cuenta del coordinador y seleccionar explícitamente los calendarios de la empresa cuando corresponda.
3. Verificar la agenda móvil en un dispositivo físico.
4. Volver a autorizar la cuenta con el permiso de disponibilidad y comprobar los bloques Ocupado del calendario correspondiente.
5. Verificar la precarga y los tiempos de navegación con una sesión real, incluyendo conexión lenta y cambios rápidos de sección o periodo.
6. Registrar los nuevos avances de los días 22 y 23 conforme se realicen.
