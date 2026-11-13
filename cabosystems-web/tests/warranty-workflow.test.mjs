import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const workflowSource = readFileSync(new URL('../src/lib/warrantyWorkflow.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(workflowSource, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { allowedWarrantyStatuses, isClosedWarrantyStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('warranty workflow only permits the next operational stage', () => {
  assert.deepEqual(allowedWarrantyStatuses('registered'), ['registered', 'review']);
  assert.deepEqual(allowedWarrantyStatuses('review'), ['review', 'waiting']);
  assert.deepEqual(allowedWarrantyStatuses('waiting'), ['waiting', 'resolved', 'rejected']);
});

test('approved and no-warranty outcomes are terminal', () => {
  assert.equal(isClosedWarrantyStatus('resolved'), true);
  assert.equal(isClosedWarrantyStatus('rejected'), true);
  assert.deepEqual(allowedWarrantyStatuses('resolved'), ['resolved']);
  assert.deepEqual(allowedWarrantyStatuses('rejected'), ['rejected']);
});

test('database migration enforces the same sequence and management routes', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261111090000_warranty_status_workflow.sql', import.meta.url), 'utf8');
  assert.match(migration, /registered'.*'review'/s);
  assert.match(migration, /review'.*'waiting'/s);
  assert.match(migration, /waiting'.*'resolved'.*'rejected'/s);
  assert.match(migration, /old\.status in \('resolved', 'rejected'\)/);
  assert.match(migration, /area in \('operations', 'supplier'\)/);
});

test('warranty updates notify the responsible person and open the warranty section', () => {
  const api = readFileSync(new URL('../src/lib/warrantyApi.ts', import.meta.url), 'utf8');
  const functionSource = readFileSync(new URL('../../supabase/functions/operations-push-notifications/index.ts', import.meta.url), 'utf8');
  const notificationCenter = readFileSync(new URL('../src/components/layout/NotificationCenter.tsx', import.meta.url), 'utf8');
  const notificationMigration = readFileSync(new URL('../../supabase/migrations/20261111100000_warranty_notifications.sql', import.meta.url), 'utf8');

  assert.match(api, /kind: 'warranty_update'/);
  assert.match(functionSource, /recipientIds = \[warranty\.responsible_id\]/);
  assert.match(functionSource, /target: 'warranties'/);
  assert.match(notificationCenter, /setActiveItem\('garantias'\)/);
  assert.match(notificationMigration, /'warranty_update'/);
});

test('notification schema accepts warranty updates and still rejects unknown kinds', async () => {
  const db = new PGlite();
  await db.exec(`
    create table app_notifications (
      kind text not null check (kind in ('task_assigned', 'field_check', 'chat_message', 'system'))
    );
  `);
  const migration = readFileSync(new URL('../../supabase/migrations/20261111100000_warranty_notifications.sql', import.meta.url), 'utf8')
    .replaceAll('public.app_notifications', 'app_notifications');
  await db.exec(migration);
  await db.query("insert into app_notifications(kind) values ('warranty_update')");
  await assert.rejects(db.query("insert into app_notifications(kind) values ('unknown')"));
  await db.close();
});

test('warranty detail merges follow-up modal into the primary history thread', () => {
  const view = readFileSync(new URL('../src/components/warranties/WarrantyManagementView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(view, /type DetailTab = 'followUp' \| 'history'/);
  assert.match(view, /id="warranty-history-panel"/);
  assert.match(view, /id="update-warranty-title"/);
  assert.match(view, /copy\.newUpdate/);
  assert.match(view, /selected\.updates\.length/);
});

test('warranty follow-up recognizes the same villa access shown by the project list', () => {
  const view = readFileSync(new URL('../src/components/warranties/WarrantyManagementView.tsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../../supabase/migrations/20261111120000_warranty_villa_access.sql', import.meta.url), 'utf8');
  assert.match(view, /projects\.some\(project => project\.id === selected\.project_id\)/);
  assert.match(migration, /private\.project_visible\(project_id\)/);
  assert.match(migration, /private\.project_visible\(c\.project_id\)/);
});

test('RLS lets a villa participant update its warranty and rejects an outsider', async () => {
  const db = new PGlite();
  const owner = 'a1000000-0000-0000-0000-000000000001';
  const participant = 'a1000000-0000-0000-0000-000000000002';
  const outsider = 'a1000000-0000-0000-0000-000000000003';
  const project = 'a1000000-0000-0000-0000-000000000004';
  const warranty = 'a1000000-0000-0000-0000-000000000005';
  await db.exec(`
    create role authenticated;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles(id uuid primary key, rol text not null, activo boolean not null);
    create table public.proyectos(id uuid primary key);
    create table public.proyecto_participantes(proyecto_id uuid not null, usuario_id uuid not null);
    create table public.warranty_cases(
      id uuid primary key, project_id uuid, responsible_id uuid not null, last_note text not null default ''
    );
    create table public.warranty_case_updates(
      id uuid primary key, case_id uuid not null, actor_id uuid not null
    );
    create function private.warranty_active_user() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.profiles where id=(select auth.uid()) and activo=true)
    $$;
    create function private.warranty_manager() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.profiles where id=(select auth.uid()) and activo=true and rol='admin')
    $$;
    create function private.project_visible(target_project uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(
        select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.activo=true and (
          p.rol='admin' or exists(
            select 1 from public.proyecto_participantes m
            where m.proyecto_id=target_project and m.usuario_id=p.id
          )
        )
      )
    $$;
    grant usage on schema public,auth,private to authenticated;
    grant execute on function auth.uid(),private.warranty_active_user(),private.warranty_manager(),private.project_visible(uuid) to authenticated;
    grant select,insert,update,delete on public.warranty_cases to authenticated;
    grant select,insert on public.warranty_case_updates to authenticated;
    alter table public.warranty_cases enable row level security;
    alter table public.warranty_case_updates enable row level security;
    insert into public.profiles values
      ('${owner}','instalador',true),('${participant}','instalador',true),('${outsider}','instalador',true);
    insert into public.proyectos values ('${project}');
    insert into public.proyecto_participantes values ('${project}','${participant}');
    insert into public.warranty_cases(id,project_id,responsible_id,last_note)
      values ('${warranty}','${project}','${owner}','Inicial');
  `);
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261111120000_warranty_villa_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261111130000_warranty_responsible_delete.sql', import.meta.url), 'utf8'));

  await db.exec(`set role authenticated; set "request.jwt.claim.sub"='${participant}'`);
  const visible = await db.query(`select id from public.warranty_cases where id='${warranty}'`);
  assert.equal(visible.rows.length, 1);
  const updated = await db.query(`update public.warranty_cases set last_note='Participante' where id='${warranty}' returning last_note`);
  assert.equal(updated.rows[0]?.last_note, 'Participante');
  const participantDelete = await db.query(`delete from public.warranty_cases where id='${warranty}' returning id`);
  assert.equal(participantDelete.rows.length, 0);

  await db.exec(`reset role; set role authenticated; set "request.jwt.claim.sub"='${outsider}'`);
  const hidden = await db.query(`select id from public.warranty_cases where id='${warranty}'`);
  assert.equal(hidden.rows.length, 0);
  const rejected = await db.query(`update public.warranty_cases set last_note='Intruso' where id='${warranty}' returning last_note`);
  assert.equal(rejected.rows.length, 0);

  await db.exec(`reset role; set role authenticated; set "request.jwt.claim.sub"='${owner}'`);
  const ownerDelete = await db.query(`delete from public.warranty_cases where id='${warranty}' returning id`);
  assert.equal(ownerDelete.rows[0]?.id, warranty);
  await db.close();
});

test('management route uses the shared listbox with Purchasing and Operations', () => {
  const view = readFileSync(new URL('../src/components/warranties/WarrantyManagementView.tsx', import.meta.url), 'utf8');
  const notifications = readFileSync(new URL('../../supabase/functions/operations-push-notifications/index.ts', import.meta.url), 'utf8');
  assert.match(view, /operations: 'Purchasing', supplier: 'Operations'/);
  assert.match(view, /ManagementRouteListbox/);
  assert.match(view, /<AppSelect/);
  assert.doesNotMatch(view, /Own account \/ supplier/);
  assert.doesNotMatch(view, /Cuenta propia \/ proveedor/);
  assert.match(notifications, /'Compras' : 'Operaciones'/);
});

test('responsible user receives a guarded warranty delete action', () => {
  const view = readFileSync(new URL('../src/components/warranties/WarrantyManagementView.tsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../../supabase/migrations/20261111130000_warranty_responsible_delete.sql', import.meta.url), 'utf8');
  assert.match(view, /selected\.responsible_id === user\?\.id \|\| manager/);
  assert.match(view, /deleteWarrantyCase\(selected\.id\)/);
  assert.match(view, /window\.confirm/);
  assert.match(migration, /responsible_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /project_visible/);
});

test('warranty start date keeps single-line layout with a Today quick-pick and villa location', () => {
  const view = readFileSync(new URL('../src/components/warranties/WarrantyManagementView.tsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../src/components/warranties/WarrantyDatePicker.tsx', import.meta.url), 'utf8');
  assert.match(picker, /min-w-0 flex-1 truncate whitespace-nowrap/);
  assert.match(picker, /flex shrink-0 items-center/);
  assert.match(picker, /aria-pressed=\{isTodaySelected\}/);
  assert.match(view, /<div className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-\[11px\] font-semibold text-slate-400">\{copy\.issue\}<\/p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">\{selected\.issue\}<\/p><\/div>/);
  assert.match(view, /villaArea: 'Área'/);
  assert.match(view, /villaArea: 'Area'/);
  assert.doesNotMatch(view, /item\.project && warrantyLocation\(item\)/);
  assert.match(view, /const cardLocation = item\.project \? warrantyLocation\(item\) : '';/);
  assert.match(view, /<p className="mt-0\.5 truncate text-xs leading-tight text-slate-500">\{item\.project \? `\$\{item\.project\.desarrollo\} - \$\{item\.project\.villa\}` : item\.location\}<\/p>/);
});
