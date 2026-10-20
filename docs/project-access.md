# Proyectos: jerarquía, equipo y accesos

## Diseño

Nuevo elemento **Proyectos** en la barra lateral web. **Tareas** y **Agenda** conservan sus vistas.

En escritorio: Desarrollos (250 px) → Villas activas → Equipo (340 px). En anchos intermedios, el equipo sustituye al panel de villas; en pantallas pequeñas se navega entre niveles. Se conserva Outfit, el tema claro TailAdmin y `#f78c26`.

El equipo incluye integrador encargado, técnico encargado y participantes adicionales. Guardar es una operación atómica con revisión del equipo: si otro administrador guardó antes, se exige recargar. Buscar y quitar un participante no afecta permisos heredados de otro alcance.

## Modelo

| Entidad | Propósito |
| --- | --- |
| `desarrollos` | Desarrollo independiente, incluso sin villas |
| `proyectos.desarrollo_id` | FK de la villa al desarrollo |
| `proyectos.integrador_id`, `tecnico_id` | Encargados de la villa; ambos conceden visibilidad |
| `proyecto_participantes` | Asignaciones explícitas por villa |
| `desarrollo_accesos` | Todas las villas actuales y futuras de un desarrollo |
| `proyecto_accesos_globales` | Todos los desarrollos y villas actuales y futuros |

El permiso global se representa con **una fila por usuario**, no con miles de membresías ni con un rol de administrador. Las comprobaciones consultan la base de datos en cada petición; no dependen de claims que deban renovarse. No hay triggers que copien los permisos globales a proyectos nuevos.

Regla de lectura: usuario activo Y (rol administrador O acceso global O acceso al desarrollo O encargado O participante). Un miembro de una villa ve el desarrollo padre, pero no sus villas hermanas. El administrador activo tiene acceso implícito sin filas de concesión. Los accesos se suman: revocar el global no elimina asignaciones individuales. Los usuarios inactivos pierden acceso aunque conserven asignaciones.

Solo administradores activos crean desarrollos/villas y modifican equipos o permisos. El acceso global permite consultar; **no** concede administración de usuarios, equipos ni tareas. Los técnicos asignados pueden actualizar el estado de su tarea y completar su checklist; las demás modificaciones de tareas requieren administrador.

## Compatibilidad y protección

- Se mantienen los IDs de villas existentes y `proyectos.desarrollo` como etiqueta compatible con la app móvil y el catálogo anterior. El ID del desarrollo es canónico; un trigger mantiene la etiqueta.
- Se crean participantes a partir de las asignaciones de tareas existentes. Una nueva asignación de tarea incorpora al usuario a la villa. El administrador puede quitar luego ese acceso explícito desde el equipo.
- Se reemplazan las políticas permisivas anteriores: añadir una política restrictiva sin eliminar las amplias no funciona porque PostgreSQL combina las políticas permisivas con OR.
- Las tareas, subtareas, pendientes y registros de campo siguen el alcance del proyecto para evitar rutas secundarias de lectura. Las funciones privadas evitan ciclos de RLS, comprueban `auth.uid()` y usuario activo, tienen `search_path` vacío y no se exponen a `anon`.
- Se impide elevar el propio rol/estado desde `profiles` y se protegen los RPC antiguos que podían modificar autoridad de perfiles. La interfaz ya no considera administrador a cualquier sesión ni crea un perfil administrador como fallback.
- La interfaz recarga al recuperar el foco y ofrece recarga manual; el servidor vuelve a comprobar los permisos en todas las consultas y escrituras.

## Validación reproducible

Desde `cabosystems-web`:

```text
npm run test:projects:db
npm test
npm run build
npm run preview:projects
```

La primera prueba ejecuta PostgreSQL local en memoria (PGlite), el esquema previo y la migración, luego comprueba RLS como `authenticated` y `anon`. Incluye herencia futura global/por desarrollo, aislamiento, revocación, encargados, usuarios inactivos, progreso propio, intentos de autoescalación y concurrencia. Revierte todas las identidades y filas ficticias.

La vista de prueba en `http://127.0.0.1:5175/` usa el componente real con API y autenticación ficticias mediante una configuración Vite separada. **No se conecta a Supabase y no forma parte de la compilación de producción.** Permite probar altas, equipo y permisos sin datos reales. `?role=member` muestra la variante de consulta, sin controles administrativos. Reiniciar la página reinicia los datos ficticios.

## Estado de aplicación

Migración: `supabase/migrations/20261015215504_project_hierarchy_and_access.sql`.

Aplicada en Supabase con autorización explícita del usuario el 15 de octubre de 2026, versión remota `20261015215504`. Se conservaron 9 villas y 5 tareas; se crearon 3 desarrollos y 5 asignaciones de participantes derivadas de tareas previas. No se concedieron accesos globales. RLS está habilitado y las políticas nuevas están instaladas. Las verificaciones de la base conectada fueron de solo lectura: la revisión automática rechazó crear fixtures en producción, por lo que las pruebas exhaustivas se mantienen en PostgreSQL local.

### Protección adicional aplicada

El asesor detectó dos RPC heredados (`actualizar_datos_usuario`, `expulsar_usuario`) ejecutables por `anon`, con un chequeo de rol susceptible al valor NULL. El trigger de autoridad original protege usuarios autenticados pero no cubre ese caso anónimo. La corrección `20261015220443_harden_legacy_profile_access.sql` cierra el caso anónimo del trigger, exige administrador activo en esos dos RPC, revoca su ejecución pública y fija el search_path de las cinco funciones de administración de perfiles. Probada localmente incluyendo un intento de escalación a través de una función SECURITY DEFINER anónima.

**Aplicada con autorización específica del usuario:** versión remota `20261015220443`. Se verificó por consultas de solo lectura que las cinco funciones exigen administrador activo, no permiten ejecución anónima y tienen search_path fijo. El asesor ya no reporta ejecución anónima ni search_path mutable en estas cinco funciones. Mantiene la advertencia informativa de SECURITY DEFINER para usuarios autenticados: es intencional y está protegida por la comprobación interna de administrador. No cambia usuarios ni les concede permisos; restringe las funciones antiguas que modifican autoridad. Referencia del asesor: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .

La pantalla web conectada se verificó con la sesión existente: listado de los tres desarrollos, villas de Chileno Bay y detalle de GE51. No hubo escrituras de equipo durante esta revisión. Evidencia: screenshots/projects-live.jpg.

## Visibilidad en móvil

Tareas y Agenda consultan todas las tareas permitidas por RLS, conservando los filtros de villa, fecha y estado. Se eliminó el filtro exclusivo por asignación personal de estas pantallas. La consulta pagina los resultados y se actualiza al regresar a la pantalla o reactivar la app. El acceso global permite consultar; únicamente el responsable de la tarea o un administrador activo puede actualizar progreso y checklist.

Diagnóstico de solo lectura del 15 de octubre: la cuenta auxiliar con acceso global podía consultar 5 tareas en 4 villas mediante RLS, pero tenía 0 tareas asignadas directamente. El filtro anterior explicaba el listado vacío. No se modificaron permisos ni datos para corregirlo. La instalación móvil debe cargar la versión actualizada para recibir este cambio.

Verificación física: en Expo Go, la cuenta auxiliar con acceso global muestra las 2 tareas de Villa 01. Agenda muestra su tarea programada y su tarea sin fecha; al seleccionar todas las villas, muestra 3 tareas sin fecha, incluyendo Casa 01 y Villa 03. No se modificaron datos. El APK independiente instalado todavía necesita una nueva compilación con estos cambios; la validación física corresponde al código actualizado ejecutado en Expo Go.
