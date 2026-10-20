# Reporte semanal de actividades: 19 al 23 de octubre de 2026

**Proyecto:** CaboSystems Field Service  
**Última actualización:** 20 de octubre de 2026  
**Corte:** avances realizados hasta el día 20. Los días 21 al 23 aún no se reportan como trabajados.

## Agenda general de la empresa

- Se separó la agenda del calendario de tareas. Ahora usa `agenda_eventos` para eventos y recordatorios generales, sin depender de villa o proyecto.
- Se incorporó la selección Evento / Recordatorio. Los recordatorios admiten repetición semanal con días de lunes a domingo, mensual y personalizada, con fecha final opcional.
- Administradores y supervisores de instalación activos pueden crear, editar y eliminar; los demás colaboradores activos consultan. La base de datos aplica estos permisos.
- Las migraciones de agenda y repetición están aplicadas en Supabase. Las tareas existentes conservan sus datos.
- La agenda web ofrece mes, semana, día, búsqueda y filtros por tipo.
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

Las correcciones posteriores de cabecera y estilos móviles, y este reporte, siguen como cambios locales al momento de este corte. No se ha publicado una actualización móvil ni se afirma un despliegue del frontend.

## Google Calendar: conexión y eventos

El usuario solicitó sincronización en ambos sentidos entre la agenda y Google Calendar. La referencia muestra una cuenta de coordinador con varios calendarios por integrante y uno de Oficina; debe conservarse esa organización, en lugar de tratarla como un solo calendario.

El usuario confirmó que el coordinador puede editar todos los calendarios. Se configuró Google Calendar API, el usuario agregó su correo de pruebas, seleccionó los permisos necesarios y creó un cliente OAuth web. La cuenta del coordinador se autorizará posteriormente.

Se implementaron la autorización segura, la selección y la consulta/gestión de eventos. Las tres funciones y la migración de tablas exclusivas del servidor están desplegadas en Supabase. Incluye PKCE, estado de un solo uso con caducidad, credencial cifrada y comprobaciones canónicas de permisos. La web y móvil consultan los calendarios seleccionados directamente en Google y combinan esos eventos con los registros locales, identificando el origen.

El usuario corrigió los secretos en Supabase, autorizó su cuenta y seleccionó un calendario. Después de incorporar la consulta de eventos, confirmó que «Hola bro, 10am» aparece en la agenda web. Se implementaron altas con reintentos sin duplicados y edición/eliminación con protección ETag, fecha final, horario de Los Cabos, eventos de varios días y recordatorios recurrentes. Las escrituras se probaron con respuestas simuladas de Google; no se modificaron eventos reales durante la implementación. Los eventos locales anteriores no se exportan automáticamente. [Detalle y límites](google-calendar-integration.md).

## Pendientes al corte

1. Probar altas, edición y eliminación en un calendario de pruebas real.
2. Autorizar la cuenta del coordinador y seleccionar explícitamente los calendarios de la empresa cuando corresponda.
3. Verificar la agenda móvil en un dispositivo físico.
4. Registrar los avances de los días 21 al 23 conforme se realicen.
