# Informes de actividad de tareas

En web: **Tasks → Informe de tareas**. Elegir periodo (diario, semana de lunes a domingo, mes o fechas personalizadas), persona que realizó la acción y villa o todas las villas accesibles. La villa abierta se selecciona inicialmente. Generar primero la vista previa y descargar PDF o XLSX. La vista previa muestra hasta 100 acciones; ambos archivos incluyen todas las páginas de resultados.

El reporte es de actividad dentro del periodo, no un inventario de todas las tareas pendientes. Distingue acción/estado registrado de estado actual al consultar, y al encargado asignado de la persona que realmente hizo el cambio. Un usuario puede marcar la misma subtarea varias veces; cada reapertura se conserva. El resumen cuenta tareas y subtareas únicas, mientras que el detalle conserva todas las acciones.

## Registro y permisos

La migración `20261029220523_task_activity_reports.sql` está aplicada. Los triggers de `tareas` y `subtareas` guardan cambios efectivos de estado, marcar/desmarcar y creación directamente en un estado avanzado. Una creación pendiente sin avances no se registra como trabajo realizado. Un reintento con el mismo valor no duplica actividad.

Cada acción guarda una fecha `date` sin hora, calculada en el servidor con `America/Mazatlan` (Los Cabos), la identidad autenticada y copias del nombre de la persona, villa, tarea, subtarea y encargado en ese momento. No se modifica el historial al reasignar, renombrar o eliminar la tarea. Las actualizaciones que fallan o se revierten tampoco generan registros persistidos.

El historial no permite INSERT/UPDATE/DELETE a clientes. Solo el trigger privado puede anexar registros. Las consultas y RPC usan RLS y permisos del usuario; el acceso por villa, desarrollo o global se conserva, y una revocación de acceso impide consultar el historial correspondiente. Usuarios inactivos y anónimos no acceden. Los reportes incluyen solo villas que siguen siendo accesibles: eliminar una villa no hace públicos sus registros históricos.

Los cambios desde web y móvil ya quedan registrados en el servidor. La interfaz de informes móvil queda para una segunda fase. En operaciones móviles sin conexión, esta primera versión registra la fecha de aceptación en el servidor, no una fecha retroactiva del dispositivo. Si se necesita atribuir al día exacto del trabajo offline, se debe añadir una fecha de ejecución explícita y validada al flujo de sincronización antes de usar estos informes para ese fin.

No se reconstruye actividad anterior a la activación: las tablas previas no guardaban la fecha/autor de cada clic. Las acciones administrativas sin identidad autenticada no se atribuyen a otra persona.

## Descargas

Las librerías PDF/Excel se cargan únicamente al descargar, para no aumentar la carga inicial de Tasks. Excel contiene Resumen y Actividad, filtros, encabezado fijo y valores de usuario como texto literal, sin fórmulas. PDF agrupa por identidad del usuario: cada persona comienza en una página nueva, conserva todas sus acciones y repite nombre, periodo, villa y resumen en las páginas de continuación. Utiliza tabla con encabezados repetidos, filas ajustadas y numeración global de páginas. Personas con nombres iguales no se mezclan. El cursor de consulta fija un ID máximo al comenzar, evitando sumar acciones nuevas durante la paginación. El estado actual refleja la lectura del reporte; no representa el estado histórico al cierre del periodo.

Dependencias nuevas fijadas: jsPDF 4.2.1, AutoTable 5.0.9 y ExcelJS 4.4.0. La auditoría de dependencias detecta el aviso transitivo de UUID en ExcelJS; el código de exportación usa exclusivamente creación de celdas y XLSX, sin UUID v3/v5/v6 ni lectura de archivos externos. También permanecen avisos previos de Vite/source-map-js, ajenos a la función.

## Validación

- `npm test` en web: 138 pruebas aprobadas, incluyendo fechas, captura por actor, transacciones, permisos, historial tras eliminación, paginación y archivos reales con más de 100 acciones.
- `node supabase/tests/task-progress.local.mjs`: permisos existentes de avance por villa con la nueva migración.
- `npm run build` en web.
- Prueba visual aislada en `tests/task-workspace-preview`: datos ficticios; descarga de ambos formatos verificada desde navegador.
- Verificación remota de RLS, privilegios de solo lectura, dos triggers activos y RPC sin elevación de privilegios. El asesor de Supabase no reporta hallazgos para los objetos nuevos.

La ventana web tiene un ancho máximo de 960 px, filtros y resumen compactos, y una tabla de vista previa con altura limitada. Las pruebas de exportación comprueban que usuarios distintos nunca aparecen en la misma página PDF y que el nombre se repite cuando su sección ocupa varias páginas.
