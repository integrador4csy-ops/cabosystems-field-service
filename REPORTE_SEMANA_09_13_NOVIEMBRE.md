# Reporte de Actividades: Semana del 9 al 13 de Noviembre

## 9. Módulo Integral de Garantías, Radar de Flota y Control Avanzado de Proyectos en Campo

### 9.1 Contexto e Introducción de la Semana
Durante esta semana, nos enfocamos en cerrar la brecha entre el trabajo administrativo en oficina y la operación real en campo. Los técnicos en las villas necesitaban saber exactamente dónde están ubicados sus compañeros y registrar sus asistencias sin depender de una red perfecta, mientras que en la plataforma web era urgente contar con un sistema formal para registrar garantías de equipos instalados (televisores, routers, cámaras, antenas) con sus números de serie y direcciones MAC. 

Asimismo, optimizamos la asignación de tareas en proyectos grandes (como Chileno Bay o El Dorado) para que los supervisores no pierdan tiempo buscando entre decenas de empleados que no pertenecen a esa villa específica.

---

### 9.2 Desarrollo e Implementación de las Actividades

#### 1. Módulo Web de Gestión de Garantías de Equipos (`WarrantyManagementView`)
Anteriormente, cuando un equipo presentaba fallas en una residencia, el seguimiento de la garantía se gestionaba de forma dispersa o en hojas de cálculo. Diseñamos e integramos un módulo centralizado dentro de la plataforma web:

* **Filtros rápidos por estado:** Implementamos pestañas para clasificar los casos en *Todas*, *Abiertas*, *En proceso*, *Resueltas* y *Canceladas*.
* **Identificación técnica de activos:** Cada caso ahora guarda información crítica de hardware: marca, modelo, número de serie del fabricante y dirección física (MAC Address), indispensable para auditorías de redes.
* **Componentes visuales personalizados:**
  * **Selector de proyectos con chips (`WarrantyProjectSelect`):** Un desplegable con buscador en vivo que agrupa las villas por desarrollo residencial (por ejemplo, *Chileno Bay (25)*, *Cove (12)*) con cabeceras fijas que se mantienen visibles al hacer scroll.
  * **Selector de fecha corporativo (`WarrantyDatePicker`):** Sustituimos el selector predeterminado del navegador por una ventana flotante con los colores oficiales de CaboSystems, con botones rápidos de "Hoy" y "Borrar" para fijar la fecha de inicio del reporte de garantía.

> **[Captura de pantalla sugerida 9.1]:** Vista general del módulo de Garantías en la plataforma web, mostrando la tabla de casos técnicos, el buscador interactivo y el selector desplegable de proyectos con los desarrollos residenciales destacados.

---

#### 2. Radar de Flota en Tiempo Real y Geocercas de Villas (`LiveFleetMap` y `maps.tsx`)
Para la aplicación móvil de los técnicos y supervisores, era necesario tener visibilidad geográfica de los compañeros de cuadrilla y delimitar con precisión las zonas de trabajo:

* **Radar Móvil con Google Maps:** Creamos la pestaña dedicada de mapas en la app móvil, permitiendo ver a la cuadrilla sobre el mapa con pines personalizados, indicando quién está activo y su última posición reportada.
* **Geocercas perimetrales para Villas (`VillaGeofenceMap`):** Integramos el cálculo de perímetros circulares en las residencias. Cuando un técnico llega a una villa y hace check-in con fotografía, el sistema puede capturar las coordenadas GPS para registrar o validar la geocerca de esa villa, asegurando que el personal realmente se encuentra en el sitio de trabajo.

> **[Captura de pantalla sugerida 9.2]:** Pantalla de la aplicación móvil mostrando la pestaña del mapa con el radar de cuadrillas en campo y la vista de delimitación perimetral (geocerca) de una villa en Cabo San Lucas.

---

#### 3. Pantalla de Historial de Asistencias y Check-ins Móviles (`checks.tsx`)
Separamos la vista de registro inmediato del historial completo de asistencias para no saturar al usuario:

* **Línea de tiempo de turnos:** El técnico ahora cuenta con una pantalla limpia donde puede revisar todos sus registros de entrada (*Check-in*) y salida (*Check-out*), acompañados de la hora exacta, dirección aproximada y la fotografía de evidencia tomada con la cámara.
* **Indicadores visuales de estado:** Etiquetas con bordes redondeados y colores estándar que diferencian si el turno sigue abierto, si concluyó correctamente o si hubo alguna observación por parte de supervisión.

> **[Captura de pantalla sugerida 9.3]:** Pantalla móvil de historial de asistencias (*Check-ins*), mostrando la lista cronológica de turnos con fecha, hora, miniatura de foto y estatus de la jornada.

---

#### 4. Resiliencia de Notificaciones Push ante Fallas de Red (`notifications.ts`)
En campo es muy habitual que los técnicos entren a sótanos, cuartos de máquinas o zonas residenciales con señal intermitente. 

* **Prevención de cierres inesperados (Crashes):** Detectamos que cuando el teléfono perdía conexión a internet y el servicio de Expo (`exp.host`) no respondía, la aplicación arrojaba un error crítico en pantalla roja (*RedBox*).
* **Solución técnica implementada:** Modificamos la biblioteca de notificaciones para atrapar de forma silenciosa el error `ERR_NOTIFICATIONS_NETWORK_ERROR`, evitando el bloqueo de la app y programando un reintento automático tras 2.5 segundos en segundo plano. Esto asegura que el técnico pueda seguir usando la app sin interrupciones aunque se quede sin cobertura momentáneamente.

---

#### 5. Optimización del Espacio de Trabajo de Tareas y Directorio de Proyectos (`TaskWorkspace.tsx` y `ProjectDirectoryView.tsx`)
En la plataforma web, pulimos la experiencia de usuario en dos puntos clave de la operación diaria:

* **Filtro dinámico de asignación de tareas:** En villas complejas con muchas tareas, el selector de personas mostraba a todos los empleados de la empresa, lo cual era confuso. Lo rediseñamos para que solo muestre a los colaboradores que tienen al menos una tarea asignada en esa villa específica, manteniendo opciones claras como "Todas las tareas", "Mis tareas" y "Sin asignar".
* **Botón unificado de participantes en proyectos:** Reemplazamos el cuadro de búsqueda genérico por un botón de acción principal `+ Agregar` con el color anaranjado oficial (`#f78c26`), abriendo un modal intuitivo para sumar ingenieros o técnicos a la villa con sus respectivos roles y permisos de acceso.

> **[Captura de pantalla sugerida 9.4]:** Espacio de trabajo de tareas en la web (*Task Workspace*), mostrando el menú desplegable filtrado únicamente con el personal asignado a la villa activa y el botón naranja de gestión de participantes.

---

### 9.3 Resumen de Resultados y Valor Aportado
* **Trazabilidad y respaldo de equipos:** Con el módulo de garantías se eliminaron las pérdidas de información sobre fechas de caducidad y números de serie de dispositivos de alto valor.
* **Confiabilidad en campo:** La app móvil ya no sufre bloqueos ante pérdidas de señal celular y cuenta con un radar visual claro para coordinar cuadrillas.
* **Eficiencia operativa:** Los supervisores gestionan asignaciones y agregan personal en la plataforma web de manera más rápida y sin sobrecarga visual.
