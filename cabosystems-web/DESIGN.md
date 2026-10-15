# Diseño web de CaboSystems

La web es una herramienta de operación para supervisar al equipo, coordinar instalaciones y administrar villas y tareas. TailAdmin es la referencia de estructura y componentes elegida por el cliente.

## Identidad

- Tema claro, superficies blancas, fondo slate-50 y bordes slate-200.
- Tipografía Outfit, con jerarquía de títulos, contenido y metadatos.
- Naranja corporativo #f78c26 (brand-500) para botones, acciones e identidad, conforme a la indicación del cliente. No sustituirlo por un naranja oscuro en el estado normal.
- Logotipos propios de CaboSystems e iconos coherentes de Lucide.
- Radios de 16 px en paneles; controles compactos y sombras sutiles.

## Idiomas

Todas las vistas web usan el selector existente de español e inglés de LanguageContext. Mantener textos, acciones, estados, roles, formularios, mensajes y etiquetas accesibles en el diccionario; los textos adicionales están en uiTranslations. Las fechas y horas usan es-MX o en-US según la preferencia, y las tarjetas del mapa se actualizan también al cambiar de idioma. No traducir nombres de personas, desarrollos o villas, ni el contenido escrito por usuarios en tareas, subtareas o mensajes. Mantener los identificadores de navegación, roles y estados en sus valores originales; traducir solo su presentación. Validar las traducciones con `npm run test:i18n`.

## Estructura y adaptación

- Barra lateral con iconos, expansión al pasar el cursor o recibir foco y opción de fijarla abierta en escritorio. Los elementos no cambian de posición al expandirse.
- En móvil, menú lateral con botón de apertura, fondo de separación y foco contenido. Se cierra al elegir una opción, tocar fuera del menú o presionar Escape; no añadir el botón «Cerrar menú».
- Cabecera adaptada a cada sección. Radar muestra búsqueda de técnicos e indicadores de flota. Tareas y Agenda comparten búsqueda por tarea, villa o responsable y el botón principal «Nueva tarea». En móvil, la búsqueda ocupa otra fila.
- Radar: el mapa usa el espacio disponible; sus controles quedan dentro de su propia capa y se reajusta cuando cambia el tamaño del contenedor.
- Tareas: tablero o lista a todo el ancho, con filtros superiores por desarrollo, villa, responsable y estado. En móvil, los filtros se despliegan con un botón para conservar espacio de trabajo. El catálogo «Villas» se abre como panel lateral con foco protegido; permite seleccionar, crear, editar y eliminar villas. Conservar el acordeón compacto y su estado al actualizar subtareas.
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

Agenda abre en «Calendario», una cuadrícula mensual de lunes a viernes. Conserva las vistas Día, Semana y Sin fecha. La navegación mensual respeta los límites del mes y el día actual se destaca en naranja. Cada fecha muestra hasta tres tareas y un enlace al día completo cuando hay más. Pulsar una tarea abre su edición; pulsar el número del día abre su detalle. Los fines de semana no tienen columnas en las vistas mensual y semanal. En móvil, la cuadrícula se desplaza dentro de su contenedor.

La sección principal se llama «Tareas», con icono de lista de tareas en la barra lateral. Las villas y los desarrollos organizan y filtran el trabajo dentro de esa página. Mostrar todas las tareas inicialmente, con su villa y fecha en la tarjeta, y permitir filtrar por villa. Mantener los controles de villas en su catálogo lateral sin un botón adicional «Administrar villas». Cada tarea tiene un único acceso para añadir subtareas en su cabecera. Conservar las confirmaciones de eliminación y la relación entre cada villa y sus tareas.

La sección ofrece «Tablero» y «Lista», compartiendo las mismas tareas y filtros. El tablero es la vista inicial y recuerda la preferencia local. Agrupa por Pendientes, En proceso y Completadas, permite buscar desde la cabecera y muestra responsables y avance de subtareas. Arrastrar desde el asa cambia el estado con la función existente de actualización; conservar el selector de estado como alternativa para teclado y pantallas táctiles. Las columnas tienen desplazamiento vertical independiente y el tablero se desplaza horizontalmente en pantallas pequeñas. Mantener superficies blancas y gris claro con acentos naranjas de CaboSystems.

## Agenda

Agenda es una vista de las mismas tareas, con fecha opcional guardada en `tareas.fecha_programada` como DATE, sin conversión UTC. La fecha se asigna o cambia al crear o editar la tarea. Ofrecer Día, Semana de lunes a domingo y Sin fecha, con navegación por periodos, selector de fecha y botón Hoy. Las tareas previas permanecen sin fecha hasta que se programen. Compartir filtros, búsqueda, edición, subtareas y estados con Tareas. En Agenda, la tarjeta muestra la villa y el responsable, sin repetir la fecha que ya aparece en el encabezado del día. Identificar tareas pendientes vencidas y conservar las completadas en su fecha. Los controles mantienen traducción español e inglés.

En las tarjetas del tablero, no repetir el estado en una etiqueta: ya lo comunica la columna. Las acciones inferiores son añadir subtarea, cambiar estado con un icono de flechas y un menú de tres puntos con «Editar» y «Eliminar». El menú abre debajo del botón, alineado a la derecha, en una capa fuera de las columnas para evitar recortes; ajustar su posición a los límites de la pantalla. Usa naranja suave para edición y rojo para eliminación, admite teclado y cierra con Escape o al tocar fuera. La vista Lista conserva sus controles de estado y edición.

## Modales minimalistas

Usar fondo blanco, bordes slate-200, campos blancos y radios de 8 px en controles. Roles, estados y acciones secundarias usan grises; la selección se distingue por el borde y el peso del texto. Reservar #f78c26 para la acción principal. Evitar fondos decorativos naranja, verde, amarillo o azul, sombras de color y efectos de escala. Conservar mensajes de error y confirmaciones de peligro reconocibles.

## Gestión de equipo

Colaboradores e Invitaciones son las dos secciones de la página de gestión de equipo, accesible desde la barra lateral y una navegación horizontal. El formulario de invitación se abre en un modal minimalista desde «Nueva invitación». No mostrar «Invitar colaborador» como opción independiente. Colaboradores e Invitaciones permanecen como secciones de página. La barra lateral muestra un único acceso «Equipo»; las secciones se eligen dentro de la página. Mantener el formulario al cambiar entre secciones y actualizar la lista de pendientes al crear una invitación. La lista de invitaciones muestra solo pendientes, sin encabezados de columna visibles. Edición de un colaborador y confirmaciones de acciones conservan diálogos con foco protegido.

## Emojis del chat web

El selector completo usa Unicode 17.0 (3,953 emojis, variantes incluidas), nombres y palabras clave de CLDR 48 en español e inglés, nueve categorías y recientes locales. El catálogo se carga al abrir el selector y la cuadrícula renderiza solo las filas visibles. Generar los datos con `../scripts/build-emoji-catalog.py`; conservar `public/emoji/LICENSE-Unicode.txt`.

Las opciones de mensaje siguen la referencia de WhatsApp con superficies claras TailAdmin: seis reacciones rápidas y «+», responder, copiar, reaccionar, fijar/desfijar y eliminar con confirmación. Usar `#f78c26` únicamente como acento. Los popovers se muestran fuera del contenedor de mensajes y se ajustan al viewport. Las respuestas incluyen cita navegable; los fijados se consultan desde la barra superior. Fijar es compartido dentro del grupo; desfijar corresponde a quien lo fijó o a un administrador.

Usar Microsoft Fluent Emoji 3D, con 3,388 imágenes WebP alojadas localmente en `public/emoji/fluent-3d` y sus licencias MIT. Los mensajes siguen siendo texto Unicode; convertir únicamente la presentación, incluidos mensajes existentes, selector y reacciones. Detectar emojis por grafemas para respetar tonos de piel, familias y secuencias ZWJ. Mostrar mensajes de solo emojis sin burbuja, con tamaño decreciente según la cantidad (72, 52, 36 o 24 px). Conservar los emojis no incluidos o con imagen fallida en su representación nativa. La importación se reproduce con `scripts/vendor-fluent-emoji.py`, fijado al paquete WebP 1.1.0.
