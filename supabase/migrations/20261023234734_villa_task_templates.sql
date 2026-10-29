-- Company template definitions and independent per-villa copies.
create table public.project_task_templates (
  id text primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  version integer not null default 1 check (version > 0),
  etapas jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.project_task_template_applications (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  plantilla_id text not null references public.project_task_templates(id),
  version integer not null,
  contenido jsonb not null,
  tareas_creadas integer not null,
  subtareas_creadas integer not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(proyecto_id, plantilla_id)
);
create index task_template_applications_template_idx on public.project_task_template_applications(plantilla_id);
create index task_template_applications_creator_idx on public.project_task_template_applications(created_by);
alter table public.tareas add column orden_plantilla integer;
alter table public.subtareas add column orden_plantilla integer;

create function private.guard_project_task_template() returns trigger
language plpgsql set search_path='' as $$
declare stage jsonb; item jsonb; seen integer[] := '{}'; n integer; total integer := 0;
begin
  if auth.uid() is not null and not private.project_admin() then
    raise exception 'Solo administradores activos pueden editar plantillas' using errcode='42501';
  end if;
  if jsonb_typeof(new.etapas) is distinct from 'array' then raise exception 'Etapas invalidas' using errcode='22023'; end if;
  if jsonb_array_length(new.etapas) not between 1 and 100 then raise exception 'Numero de etapas invalido' using errcode='22023'; end if;
  for stage in select value from jsonb_array_elements(new.etapas) loop
    if jsonb_typeof(stage) is distinct from 'object' or jsonb_typeof(stage->'number') is distinct from 'number'
       or coalesce(stage->>'number','') !~ '^[1-9][0-9]{0,2}$'
       or jsonb_typeof(stage->'title') is distinct from 'string'
       or coalesce(length(btrim(stage->>'title')),0) not between 1 and 400
       or jsonb_typeof(stage->'subtasks') is distinct from 'array' then
      raise exception 'Etapa invalida' using errcode='22023';
    end if;
    n := (stage->>'number')::integer;
    if n = any(seen) then raise exception 'Numeracion duplicada' using errcode='22023'; end if;
    seen := array_append(seen,n);
    if jsonb_array_length(stage->'subtasks') > 100 then raise exception 'Demasiadas subtareas' using errcode='22023'; end if;
    total := total + jsonb_array_length(stage->'subtasks');
    if total > 2000 then raise exception 'Demasiadas subtareas' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(stage->'subtasks') loop
      if jsonb_typeof(item) is distinct from 'string' or length(btrim(item#>>'{}')) not between 1 and 500 then
        raise exception 'Subtarea invalida' using errcode='22023';
      end if;
    end loop;
  end loop;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id then raise exception 'No se puede cambiar la identidad de la plantilla' using errcode='22023'; end if;
    new.version := old.version+1;
  else new.version := 1;
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.guard_project_task_template() from public,anon,authenticated;
create trigger project_task_template_guard before insert or update on public.project_task_templates
for each row execute function private.guard_project_task_template();

alter table public.project_task_templates enable row level security;
alter table public.project_task_template_applications enable row level security;
revoke all on public.project_task_templates,public.project_task_template_applications from anon,authenticated;
grant select,insert,update on public.project_task_templates to authenticated;
grant select,insert on public.project_task_template_applications to authenticated;
create policy task_templates_admin_read on public.project_task_templates for select to authenticated using((select private.project_admin()));
create policy task_templates_admin_insert on public.project_task_templates for insert to authenticated with check((select private.project_admin()));
create policy task_templates_admin_update on public.project_task_templates for update to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy task_template_applications_read on public.project_task_template_applications for select to authenticated using(private.project_visible(proyecto_id));
create policy task_template_applications_admin on public.project_task_template_applications for insert to authenticated with check((select private.project_admin()) and created_by=(select auth.uid()));

create function public.apply_project_task_template(p_proyecto_id uuid, p_plantilla_id text, p_version integer, p_etapas integer[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare template public.project_task_templates%rowtype; application public.project_task_template_applications%rowtype;
  stage jsonb; selected jsonb; task_id uuid; sub record; task_count integer; sub_count integer;
begin
  if not private.project_admin() then raise exception 'Solo administradores activos pueden aplicar plantillas' using errcode='42501'; end if;
  -- One concurrent application per villa; existing task and subtask policies remain in force.
  perform 1 from public.proyectos where id=p_proyecto_id for update;
  if not found then raise exception 'Villa no disponible' using errcode='42501'; end if;
  select * into application from public.project_task_template_applications where proyecto_id=p_proyecto_id and plantilla_id=p_plantilla_id;
  if found then return jsonb_build_object('alreadyApplied',true,'tasks',application.tareas_creadas,'subtasks',application.subtareas_creadas); end if;
  select * into template from public.project_task_templates where id=p_plantilla_id for share;
  if not found then raise exception 'Plantilla no disponible' using errcode='22023'; end if;
  if p_version is distinct from template.version then raise exception 'La plantilla cambio; vuelve a cargarla' using errcode='40001'; end if;
  if p_etapas is null or cardinality(p_etapas)=0 or cardinality(p_etapas)>100
    or array_position(p_etapas,null) is not null
    or cardinality(p_etapas)<>(select count(distinct value) from unnest(p_etapas) value)
    or exists(select 1 from unnest(p_etapas) n where not exists(select 1 from jsonb_array_elements(template.etapas) s where (s->>'number')::integer=n)) then
    raise exception 'Seleccion de etapas invalida' using errcode='22023';
  end if;
  select jsonb_agg(value order by (value->>'number')::integer), count(*)::integer,
         coalesce(sum(jsonb_array_length(value->'subtasks')),0)::integer into selected,task_count,sub_count
    from jsonb_array_elements(template.etapas) where (value->>'number')::integer=any(p_etapas);
  insert into public.project_task_template_applications(proyecto_id,plantilla_id,version,contenido,tareas_creadas,subtareas_creadas)
    values(p_proyecto_id,template.id,template.version,selected,task_count,sub_count) returning * into application;
  for stage in select value from jsonb_array_elements(selected) loop
    insert into public.tareas(proyecto_id,titulo,estatus,asignado_a,fecha_programada,orden_plantilla)
      values(p_proyecto_id,(stage->>'number')||'. '||btrim(stage->>'title'),'pendiente',null,null,(stage->>'number')::integer)
      returning id into task_id;
    for sub in select value,ordinality from jsonb_array_elements_text(stage->'subtasks') with ordinality loop
      insert into public.subtareas(tarea_id,titulo,completada,orden_plantilla)
        values(task_id,(stage->>'number')||'.'||sub.ordinality||' '||btrim(sub.value),false,sub.ordinality::integer);
    end loop;
  end loop;
  return jsonb_build_object('alreadyApplied',false,'tasks',task_count,'subtasks',sub_count);
end; $$;
revoke all on function public.apply_project_task_template(uuid,text,integer,integer[]) from public,anon;
grant execute on function public.apply_project_task_template(uuid,text,integer,integer[]) to authenticated;

insert into public.project_task_templates(id,nombre,etapas)
values('csy-general','Plantilla general CaboSystems','[{"number":1,"title":"Contacto con el cliente","subtasks":["Contacto con el cliente","Enviar información del proyecto"]},{"number":2,"title":"Anteproyecto","subtasks":["Solicitud de planos","Revisión de planos (CAD)","Levantamiento en sitio y/o planos","Revisión de status de obra","Contactos del proyecto"]},{"number":3,"title":"Diseño de proyecto","subtasks":["Dibujo de planos CSY","Especificaciones","Propuesta"]},{"number":4,"title":"Nuevo proyecto","subtasks":["W.O. autorizada","Carpeta de proyecto (SERVCSY)","Carpeta de proyecto (Drive)","Archivo de información (Drive)","Cronograma","Asignación de responsables de instalación e integración","Plano de zonas de audio","Plano y lista de cableado","Solicitud de dimensiones y/o alzados de mobiliario en zonas donde hay TVs","Archivo seguimiento de proyecto (WO)"]},{"number":5,"title":"Seguimiento de infraestructura y obra","subtasks":["Supervisión de obra","Suministro de cajones de bocina","Suministro de gabinetes empotrados (CP)","Suministro de registros de jardín","Preparaciones y conexión HVAC","Preparaciones y conexión para pool","Preparaciones y conexión Lutron","Preparaciones y conexión para cortinas","Solicitud de dimensiones y/o alzados de mobiliario en zonas donde hay TVs"]},{"number":6,"title":"Integración / pruebas oficina","subtasks":["Programación oficina","Creación de cuentas (Drive)","Diagramas Visio (SERVCSY)","Archivo de programación Savant","Ensamblado de rack (laboratorio)","Configuración red","Configuración pruebas de NVR y cámaras","Savant Host: activación y alta en Central","Savant Host: alta en AnyDesk","Prueba de audio (laboratorio)","Configuración pruebas equipos video en rack","Configuración pruebas doorphone laboratorio","Configuración equipos WattBox OvrC","Configuración telefonía"]},{"number":7,"title":"Cableado","subtasks":[]},{"number":8,"title":"Accesorios","subtasks":["Jacks, keystones, etc.","Wallplates, 6-port frame, etc."]},{"number":9,"title":"Communication panel","subtasks":[]},{"number":10,"title":"Certificación de cableado","subtasks":[]},{"number":11,"title":"Instalaciones fase 3","subtasks":["Instalación de bocinas","Instalación cámaras","Instalación access points","Interconexión de rack","Instalación de TVs"]},{"number":12,"title":"Conexiones de TVs y equipos","subtasks":[]},{"number":13,"title":"Instalaciones fase 4","subtasks":["Instalación de teléfonos","Instalación de controles e interfaces de usuario","Instalación de controles","Instalación de iPads"]},{"number":14,"title":"Programación en sitio (puesta en marcha)","subtasks":["Audio (música)","WiFi","TVs","CableTV (IPTV, Amino, etc.)","Apple TVs","Telefonía","Controles","Integración pool","Integración HVAC","Integración shades","Integración iluminación","Calibración de audio (bocinas)","Calibración de audio (AVR: Marantz, etc.)","WiFi: heat map y calibración","Savant: fotografías de home y zonas"]},{"number":15,"title":"Entrega de proyecto","subtasks":["Manuales (Drive)","Plano CSY (Asbuilt)","Recorrido integración (VoBo)","Inventario físico","Pre-entrega","Carpeta entrega (Drive)","Carpeta entrega (física)","Conciliación con almacén","Entrega"]},{"number":16,"title":"Pendientes y notas","subtasks":[]}]'::jsonb);
