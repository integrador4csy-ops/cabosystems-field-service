# Diseño web de CaboSystems

La web es una herramienta de operación para supervisar al equipo, coordinar instalaciones y administrar villas y tareas. TailAdmin es la referencia de estructura y componentes elegida por el cliente.

## Identidad

- Tema claro, superficies blancas, fondo slate-50 y bordes slate-200.
- Tipografía Outfit, con jerarquía de títulos, contenido y metadatos.
- Naranja corporativo #f78c26 (brand-500) para botones, acciones e identidad, conforme a la indicación del cliente. No sustituirlo por un naranja oscuro en el estado normal.
- Logotipos propios de CaboSystems e iconos coherentes de Lucide.
- Radios de 16 px en paneles; controles compactos y sombras sutiles.
- Escala global de la web al 110 % mediante `--app-zoom`. Las alturas y anchuras de viewport usan las variables compensadas `--app-viewport-height` y `--app-viewport-width`; los menús anclados convierten sus coordenadas con `layoutViewport` para conservar alineación. El zoom adicional del navegador sigue disponible.

## Idiomas

Todas las vistas web usan el selector existente de español e inglés de LanguageContext. Mantener textos, acciones, estados, roles, formularios, mensajes y etiquetas accesibles en el diccionario; los textos adicionales están en uiTranslations. Las fechas y horas usan es-MX o en-US según la preferencia, y las tarjetas del mapa se actualizan también al cambiar de idioma. No traducir nombres de personas, desarrollos o villas, ni el contenido escrito por usuarios en tareas, subtareas o mensajes. Mantener los identificadores de navegación, roles y estados en sus valores originales; traducir solo su presentación. Validar las traducciones con `npm run test:i18n`.

## Estructura y adaptación

- Barra lateral con iconos, expansión al pasar el cursor o recibir foco y opción de fijarla abierta en escritorio. Los elementos no cambian de posición al expandirse.
- En móvil, menú lateral con botón de apertura, fondo de separación y foco contenido. Se cierra al elegir una opción, tocar fuera del menú o presionar Escape; no añadir el botón «Cerrar menú».
- Cabecera adaptada a cada sección. Radar muestra búsqueda de técnicos e indicadores de flota. Tareas busca por tarea, villa o responsable y muestra «Nueva tarea». Agenda tiene búsqueda independiente por evento, recordatorio o ubicación y muestra «Nuevo evento» para administradores y supervisores activos. En móvil, la búsqueda ocupa otra fila.
- Radar: el mapa usa el espacio disponible; sus controles quedan dentro de su propia capa y se reajusta cuando cambia el tamaño del contenedor.
- Tareas por villa: panel dividido en escritorio. A la izquierda, desarrollos con sus villas en listas desplegables, plegadas inicialmente. Pulsar el desarrollo solo despliega sus villas; no hay selección del desarrollo completo ni «Todas las tareas». Siempre se muestra una única villa, recordada si sigue disponible o la primera accesible. Un botón compacto para limpiar filtros aparece junto a los selectores cuando hay filtros activos; conserva la villa. A la derecha, desarrollo y villa en la cabecera. En una misma barra compacta están Tablero/Lista, el contador, Responsable, Estado y un switch con flechas para orden Ascendente/Descendente. Estado se aplica en ambas vistas. El orden compara los títulos con números naturales (2 antes de 10) y recuerda la preferencia de la pestaña. No se muestra el aviso persistente de plantilla aplicada. Hasta 900 px el panel se convierte en un desplegable superior que se cierra al seleccionar; el tablero conserva su desplazamiento horizontal. Conservar el acordeón de subtareas y su estado al actualizar.
- Chat: lista y conversación en escritorio; lista, conversación y botón para volver en móvil.
- Personal e invitaciones: tablas con desplazamiento horizontal cuando el ancho no alcanza para todas las acciones.

## Interacción

- Los controles deben tener nombres accesibles y foco visible.
- Los selectores de una opción usan AppSelect: fondo blanco, borde slate-200, menú con selección naranja y texto blanco, navegación con teclado y menú fuera del contenedor para evitar recortes. Conservar el selector nativo oculto para los eventos y la validación de formularios.
- Los diálogos de edición y creación contienen el foco, permiten cerrar con Escape y devuelven el foco al control de origen.
- Mantener avisos de carga, vacío y error; permitir reintentar donde corresponda.
- Respetar la preferencia de movimiento reducido.
- No añadir gráficos, indicadores o secciones sin una función operativa real.
- Las skills de diseño apoyan esta referencia y la identidad, sin imponer un estilo ajeno al producto.

## Tareas y villas

Los administradores activos pueden aplicar la plantilla general CaboSystems a la villa seleccionada desde su cabecera. Abrir una vista previa de etapas seleccionables con subtareas desplegables y cantidades; crear solo al pulsar la acción final. La edición de la plantilla general vive en esa ventana, conserva la numeración y afecta únicamente a nuevas aplicaciones. Cada villa recibe una copia independiente y se impide aplicar la plantilla dos veces. Véase `../docs/task-templates.md`.

La programación de tareas conserva sus fechas en `tareas.fecha_programada`. La agenda general web tiene su propio calendario de eventos, descrito abajo, y no presenta las tareas como eventos.

La sección se llama «Tareas por villa» / «Villa tasks». La búsqueda descubre coincidencias en todos los desarrollos y villas accesibles, pero muestra una sola villa a la vez: conserva la villa elegida si contiene coincidencias o selecciona la primera villa coincidente. Buscar una villa única la selecciona incluso si no tiene tareas. Al borrar el texto se recupera la selección anterior. El menú lateral refleja y despliega la villa de búsqueda. Los filtros de responsable y estado siguen aplicándose. Las tarjetas no repiten desarrollo ni villa: solo muestran la fecha si existe. Junto al contador de subtareas aparece la foto del asignado, con su nombre accesible y al pasar el cursor; sin foto o con imagen fallida se usan iniciales, y sin responsable un icono. Mantener las confirmaciones de eliminación y la relación entre villa, tareas y subtareas.

La sección ofrece «Tablero» y «Lista», compartiendo las mismas tareas y filtros. El tablero es la vista inicial y recuerda la preferencia local. Agrupa por Pendientes, En proceso y Completadas, permite buscar desde la cabecera y muestra responsables y avance de subtareas. Arrastrar desde el asa cambia el estado con la función existente de actualización; conservar el selector de estado como alternativa para teclado y pantallas táctiles. Las columnas tienen desplazamiento vertical independiente y el tablero se desplaza horizontalmente en pantallas pequeñas. Mantener superficies blancas y gris claro con acentos naranjas de CaboSystems.

## Agenda

Agenda web es el calendario general de la empresa: entregas de casas, pruebas de rack y otros eventos o recordatorios. Usa `agenda_eventos`, independiente de tareas y proyectos. El formulario permite elegir Tipo: Evento o Recordatorio, título obligatorio, fecha obligatoria, hora opcional, ubicación y descripción. Al elegir Recordatorio se muestra Repetir: No repetir, Cada semana (selección múltiple de lunes a domingo), Cada mes o Personalizado (cada N días, semanas o meses). Permitir terminar en una fecha o continuar sin fecha final. Los meses cortos usan el último día disponible; informar esta regla. Las series aparecen automáticamente en el calendario en los días correspondientes. Indicar que editar o eliminar afecta a toda la serie. Los recordatorios son registros visibles, sin notificaciones automáticas.

Abre en Mes y ofrece Semana y Día, navegación por periodos, selector de fecha y botón Hoy. Las vistas incluyen lunes a domingo para no ocultar eventos de fin de semana; en móvil las cuadrículas se desplazan dentro de su contenedor. Mostrar hasta tres registros por celda y enlace al día cuando hay más. Pulsar un registro abre sus detalles; administradores y supervisores activos pueden crearlo, editarlo y eliminarlo con confirmación. El resto de colaboradores activos solo consulta. La búsqueda y el filtro Evento/Recordatorio pertenecen exclusivamente a Agenda. Conservar idioma español/inglés, fechas locales sin conversión UTC y actualizaciones en tiempo real.

En las tarjetas del tablero, no repetir el estado en una etiqueta: ya lo comunica la columna. Las acciones inferiores son añadir subtarea, cambiar estado con un icono de flechas y un menú de tres puntos con «Editar» y «Eliminar». El menú abre debajo del botón, alineado a la derecha, en una capa fuera de las columnas para evitar recortes; ajustar su posición a los límites de la pantalla. Usa naranja suave para edición y rojo para eliminación, admite teclado y cierra con Escape o al tocar fuera. La vista Lista conserva sus controles de estado y edición.

## Modales minimalistas

Usar fondo blanco, bordes slate-200, campos blancos y radios de 8 px en controles. Roles, estados y acciones secundarias usan grises; la selección se distingue por el borde y el peso del texto. Reservar #f78c26 para la acción principal. Evitar fondos decorativos naranja, verde, amarillo o azul, sombras de color y efectos de escala. Conservar mensajes de error y confirmaciones de peligro reconocibles.

## Gestión de equipo

Colaboradores e Invitaciones son las dos secciones de la página de gestión de equipo, accesible desde la barra lateral y una navegación horizontal. El formulario de invitación se abre en un modal minimalista desde «Nueva invitación». No mostrar «Invitar colaborador» como opción independiente. Colaboradores e Invitaciones permanecen como secciones de página. La barra lateral muestra un único acceso «Equipo»; las secciones se eligen dentro de la página. Mantener el formulario al cambiar entre secciones y actualizar la lista de pendientes al crear una invitación. La lista de invitaciones muestra solo pendientes, sin encabezados de columna visibles. Edición de un colaborador y confirmaciones de acciones conservan diálogos con foco protegido.

## Emojis del chat web

El selector completo usa Unicode 17.0 (3,953 emojis, variantes incluidas), nombres y palabras clave de CLDR 48 en español e inglés, nueve categorías y recientes locales. El catálogo se carga al abrir el selector y la cuadrícula renderiza solo las filas visibles. Generar los datos con `../scripts/build-emoji-catalog.py`; conservar `public/emoji/LICENSE-Unicode.txt`.

Las opciones de mensaje siguen la referencia de WhatsApp con superficies claras TailAdmin: seis reacciones rápidas y «+», responder, copiar, reaccionar, fijar/desfijar y eliminar con confirmación. Usar `#f78c26` únicamente como acento. Los popovers se muestran fuera del contenedor de mensajes y se ajustan al viewport. Las respuestas incluyen cita navegable; los fijados se consultan desde la barra superior. Fijar es compartido dentro del grupo; desfijar corresponde a quien lo fijó o a un administrador.

Usar Microsoft Fluent Emoji 3D, con 3,388 imágenes WebP alojadas localmente en `public/emoji/fluent-3d` y sus licencias MIT. Los mensajes siguen siendo texto Unicode; convertir únicamente la presentación, incluidos mensajes existentes, selector y reacciones. Detectar emojis por grafemas para respetar tonos de piel, familias y secuencias ZWJ. Mostrar mensajes de solo emojis sin burbuja, con tamaño decreciente según la cantidad (72, 52, 36 o 24 px). Conservar los emojis no incluidos o con imagen fallida en su representación nativa. La importación se reproduce con `scripts/vendor-fluent-emoji.py`, fijado al paquete WebP 1.1.0.
