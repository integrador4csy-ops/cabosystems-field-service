import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronRight, CircleDashed,
  Clock3, Hash, PackageCheck, ShieldCheck, X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useSidebar } from '../../context/SidebarContext';
import { supabase } from '../../lib/supabase';
import {
  createWarrantyCase, getWarrantyCases, getWarrantyProjects, updateWarrantyCase,
  warrantyFolio, type WarrantyArea, type WarrantyCase, type WarrantyProject,
  type WarrantyStatus,
} from '../../lib/warrantyApi';
import { WarrantyDatePicker } from './WarrantyDatePicker';
import { WarrantyProjectSelect } from './WarrantyProjectSelect';

type Filter = 'all' | 'open' | 'waiting' | 'closed';

const statusOrder: WarrantyStatus[] = ['registered', 'review', 'waiting', 'resolved', 'rejected'];
let warrantyChannelSequence = 0;

const labels = {
  es: {
    title: 'Control de garantías', subtitle: 'Casos claros, responsables visibles y seguimiento en un solo lugar.',
    newCase: 'Nueva garantía', search: 'Buscar folio, villa, área, equipo o serie…', all: 'Todos', open: 'Abiertos', waiting: 'Esperando', closed: 'Cerrados',
    registered: 'Registrada', review: 'En revisión', resolved: 'Resuelta', rejected: 'Sin garantía',
    project: 'Proyecto', laboratory: 'Laboratorio', operations: 'Operaciones', supplier: 'Proveedor', client: 'Cliente',
    responsible: 'Responsable', noCases: 'No hay casos en esta vista', noCasesHint: 'Crea una garantía o cambia los filtros para ver otros casos.',
    caseData: 'Datos del caso', equipment: 'Equipo', serial: 'Número o serie', macAddress: 'MAC address', villa: 'Villa', issue: 'Falla reportada', issuePlaceholder: 'Ej. Bedroom 2: el amplificador no enciende.', deadline: 'Fecha de inicio', noDeadline: 'Sin fecha de inicio',
    followUp: 'Actualizar seguimiento', stage: 'Etapa', note: 'Nota del avance', notePlaceholder: 'Ej. Proveedor confirmó recepción; respuesta estimada en 5 días.', save: 'Guardar avance', saving: 'Guardando…',
    history: 'Historial', createdBy: 'Proceso levantado por', created: 'Caso registrado', cancel: 'Cancelar', create: 'Crear caso', creating: 'Creando…',
    selectVilla: 'Villa', noVilla: 'Selecciona una villa', optional: 'Opcional', required: 'Completa los campos requeridos.', loadError: 'No se pudieron cargar las garantías.', saveError: 'No se pudo guardar el caso. Intenta de nuevo.',
    currentUser: 'Se asignará automáticamente a', today: 'Hoy', status: 'Estado', updated: 'Actualizado', selectCase: 'Selecciona un caso para consultar su seguimiento.',
  },
  en: {
    title: 'Warranty control', subtitle: 'Clear cases, visible ownership and follow-up in one place.',
    newCase: 'New warranty', search: 'Search folio, villa, area, equipment or serial…', all: 'All', open: 'Open', waiting: 'Waiting', closed: 'Closed',
    registered: 'Registered', review: 'Under review', resolved: 'Resolved', rejected: 'No warranty',
    project: 'Project', laboratory: 'Laboratory', operations: 'Operations', supplier: 'Supplier', client: 'Client',
    responsible: 'Owner', noCases: 'No cases in this view', noCasesHint: 'Create a warranty or change the filters to see other cases.',
    caseData: 'Case details', equipment: 'Equipment', serial: 'Number or serial', macAddress: 'MAC address', villa: 'Villa', issue: 'Reported issue', issuePlaceholder: 'E.g. Bedroom 2: the amplifier will not turn on.', deadline: 'Start date', noDeadline: 'No start date',
    followUp: 'Update follow-up', stage: 'Stage', note: 'Progress note', notePlaceholder: 'E.g. Supplier confirmed receipt; response expected in 5 days.', save: 'Save update', saving: 'Saving…',
    history: 'History', createdBy: 'Process opened by', created: 'Case registered', cancel: 'Cancel', create: 'Create case', creating: 'Creating…',
    selectVilla: 'Villa', noVilla: 'Select a villa', optional: 'Optional', required: 'Complete the required fields.', loadError: 'Warranties could not be loaded.', saveError: 'The case could not be saved. Try again.',
    currentUser: 'Automatically assigned to', today: 'Today', status: 'Status', updated: 'Updated', selectCase: 'Select a case to review its follow-up.',
  },
} as const;

function statusLabel(copy: typeof labels.es | typeof labels.en, status: WarrantyStatus) {
  return copy[status];
}

function statusStyle(status: WarrantyStatus) {
  if (status === 'resolved') return 'border-slate-900 bg-slate-900 text-white';
  if (status === 'rejected') return 'border-slate-300 bg-white text-slate-600';
  if (status === 'waiting') return 'border-orange-300 bg-orange-100 text-orange-800';
  if (status === 'review') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function formatDate(value: string, locale: string, withTime = false) {
  return new Intl.DateTimeFormat(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value));
}

function StatusBadge({ status, copy }: { status: WarrantyStatus; copy: typeof labels.es | typeof labels.en }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(status)}`}>{statusLabel(copy, status)}</span>;
}

export function WarrantyManagementView() {
  const { user, adminProfile } = useAdminAuth();
  const { language, locale } = useTranslation();
  const { warrantySearchQuery, setWarrantySearchQuery, warrantyCreateVersion } = useSidebar();
  const copy = labels[language === 'en' ? 'en' : 'es'];
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [projects, setProjects] = useState<WarrantyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const createRequest = useRef(warrantyCreateVersion);
  const [createForm, setCreateForm] = useState({ project_id: '', location: '', equipment: '', serial_number: '', mac_address: '', issue: '', area: 'project' as WarrantyArea, warranty_until: '', last_note: '' });
  const [updateForm, setUpdateForm] = useState({ status: 'registered' as WarrantyStatus, area: 'project' as WarrantyArea, warranty_until: '', last_note: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextCases, nextProjects] = await Promise.all([getWarrantyCases(), getWarrantyProjects()]);
      setCases(nextCases);
      setProjects(nextProjects);
      setSelectedId((current) => current && nextCases.some(item => item.id === current) ? current : nextCases[0]?.id ?? null);
    } catch (loadError) {
      console.error('Warranty load failed:', loadError);
      setError(copy.loadError);
    } finally { setLoading(false); }
  }, [copy.loadError]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`warranty-cases-${user.id}-${++warrantyChannelSequence}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranty_cases' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, load]);

  const selected = cases.find(item => item.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setUpdateForm({ status: selected.status, area: selected.area, warranty_until: selected.warranty_until || '', last_note: '' });
    setFormError('');
  }, [selected?.id, selected?.status, selected?.area, selected?.warranty_until]);

  const counts = useMemo(() => ({
    all: cases.length,
    open: cases.filter(item => ['registered', 'review'].includes(item.status)).length,
    waiting: cases.filter(item => item.status === 'waiting').length,
    closed: cases.filter(item => ['resolved', 'rejected'].includes(item.status)).length,
  }), [cases]);

  const filtered = useMemo(() => {
    const needle = warrantySearchQuery.trim().toLocaleLowerCase();
    return cases.filter(item => {
      if (filter === 'open' && !['registered', 'review'].includes(item.status)) return false;
      if (filter === 'waiting' && item.status !== 'waiting') return false;
      if (filter === 'closed' && !['resolved', 'rejected'].includes(item.status)) return false;
      if (!needle) return true;
      return [warrantyFolio(item.case_number), item.project?.desarrollo, item.project?.villa, item.equipment, item.serial_number, item.mac_address, item.location, item.issue, item.responsible?.nombre]
        .some(value => value?.toLocaleLowerCase().includes(needle));
    });
  }, [cases, filter, warrantySearchQuery]);

  const openCreate = useCallback(() => {
    setCreateForm({ project_id: '', location: '', equipment: '', serial_number: '', mac_address: '', issue: '', area: 'project', warranty_until: '', last_note: '' });
    setFormError(''); setCreateOpen(true);
  }, []);

  useEffect(() => {
    if (createRequest.current === warrantyCreateVersion) return;
    createRequest.current = warrantyCreateVersion;
    openCreate();
  }, [warrantyCreateVersion, openCreate]);
  useEffect(() => () => setWarrantySearchQuery(''), [setWarrantySearchQuery]);

  const chooseProject = (projectId: string, project?: WarrantyProject) => {
    const targetProject = project || projects.find(item => item.id === projectId);
    setCreateForm(current => ({
      ...current,
      project_id: projectId,
      location: targetProject ? `${targetProject.desarrollo} · ${targetProject.villa}` : '',
    }));
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id || !createForm.project_id || !createForm.equipment.trim() || !createForm.issue.trim()) { setFormError(copy.required); return; }
    setSaving(true); setFormError('');
    try {
      const created = await createWarrantyCase({ ...createForm, responsible_id: user.id });
      setCases(current => [created, ...current]); setSelectedId(created.id); setCreateOpen(false);
    } catch (saveError) { console.error('Warranty create failed:', saveError); setFormError(copy.saveError); }
    finally { setSaving(false); }
  };

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !updateForm.last_note.trim()) { setFormError(copy.required); return; }
    setSaving(true); setFormError('');
    try {
      const updated = await updateWarrantyCase(selected.id, updateForm);
      setCases(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (saveError) { console.error('Warranty update failed:', saveError); setFormError(copy.saveError); }
    finally { setSaving(false); }
  };

  const manager = Boolean(adminProfile?.rol && ['admin', 'supervisor_instalacion', 'aux_operaciones'].includes(adminProfile.rol));
  const canUpdate = Boolean(selected && (selected.responsible_id === user?.id || manager));

  return <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
      <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-100 p-4">
          <div className="flex gap-1 overflow-x-auto" role="tablist">{(['all','open','waiting','closed'] as Filter[]).map(item => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{copy[item]} <span className={filter === item ? 'text-white/65' : 'text-slate-400'}>{counts[item]}</span></button>)}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? <div role="alert" className="m-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</div> : null}
          {loading ? <div className="space-y-2 p-2">{[0,1,2].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
          {!loading && filtered.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center"><PackageCheck size={34} className="text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-700">{copy.noCases}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{copy.noCasesHint}</p></div> : null}
          {filtered.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`mb-1.5 w-full rounded-xl border p-3.5 text-left transition-colors ${selectedId === item.id ? 'border-orange-300 bg-orange-50/60' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === 'waiting' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}><PackageCheck size={18} /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-900">{item.equipment}</p><span className="shrink-0 text-[11px] font-semibold text-slate-400">{warrantyFolio(item.case_number)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{item.project ? `${item.project.desarrollo} · ${item.project.villa}` : item.location}{item.serial_number ? ` · ${item.serial_number}` : ''}</p><div className="mt-2 flex items-center justify-between gap-2"><StatusBadge status={item.status} copy={copy} /><span className="truncate text-[11px] text-slate-500">{item.responsible?.nombre || copy.responsible}</span></div></div>
              <ChevronRight size={17} className="mt-2 shrink-0 text-slate-300" />
            </div>
          </button>)}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto bg-slate-50/45">
        {!selected ? <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 text-center"><ShieldCheck size={38} className="text-slate-300" /><p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">{copy.selectCase}</p></div> : <div className="p-5">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Hash size={13} />{warrantyFolio(selected.case_number)}</div><h3 className="mt-1 text-xl font-semibold text-slate-900">{selected.equipment}</h3></div><StatusBadge status={selected.status} copy={copy} /></div>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
            <div className="bg-white p-3"><p className="text-[11px] font-medium text-slate-400">{copy.villa}</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.project ? `${selected.project.desarrollo} · ${selected.project.villa}` : '—'}</p></div>
            <div className="bg-white p-3"><p className="text-[11px] font-medium text-slate-400">{copy.serial}</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.serial_number || '—'}</p></div>
            <div className="bg-white p-3"><p className="text-[11px] font-medium text-slate-400">{copy.macAddress}</p><p className="mt-1 break-all font-mono text-sm font-semibold text-slate-700">{selected.mac_address || '—'}</p></div>
            <div className="bg-white p-3"><p className="text-[11px] font-medium text-slate-400">{copy.responsible}</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.responsible?.nombre || '—'}</p></div>
            <div className="bg-white p-3"><p className="text-[11px] font-medium text-slate-400">{copy.deadline}</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.warranty_until ? formatDate(`${selected.warranty_until}T12:00:00`, locale) : copy.noDeadline}</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{copy.issue}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.issue}</p></div>

          {canUpdate ? <form onSubmit={submitUpdate} className="mt-4 rounded-xl border border-orange-200 bg-white p-4 shadow-xs"><h4 className="text-sm font-semibold text-slate-900">{copy.followUp}</h4><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">{copy.stage}<select value={updateForm.status} onChange={event => setUpdateForm(current => ({ ...current, status: event.target.value as WarrantyStatus }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500">{statusOrder.map(status => <option key={status} value={status}>{statusLabel(copy, status)}</option>)}</select></label><div><label className="block text-xs font-medium text-slate-600 mb-1.5">{copy.deadline} <span className="font-normal text-slate-400">({copy.optional})</span></label><WarrantyDatePicker value={updateForm.warranty_until} onChange={val => setUpdateForm(current => ({ ...current, warranty_until: val }))} locale={locale} /></div></div><label className="mt-3 block text-xs font-medium text-slate-600">{copy.note}<textarea required rows={3} value={updateForm.last_note} onChange={event => setUpdateForm(current => ({ ...current, last_note: event.target.value }))} placeholder={copy.notePlaceholder} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" /></label>{formError ? <p role="alert" className="mt-2 text-xs text-orange-700">{formError}</p> : null}<button disabled={saving} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? copy.saving : copy.save}</button></form> : null}

          <div className="mt-5"><h4 className="text-sm font-semibold text-slate-900">{copy.history}</h4><ol className="mt-3 space-y-0">{selected.updates.map((update, index) => <li key={update.id} className="relative flex gap-3 pb-5"><div className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-500">{index === 0 ? <Clock3 size={14} /> : <CircleDashed size={14} />}</div>{index < selected.updates.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-28px)] w-px bg-slate-200" /> : null}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">{statusLabel(copy, update.status)}</p><time className="text-[10px] text-slate-400">{formatDate(update.created_at, locale, true)}</time></div>{update.note ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{update.note}</p> : null}<p className="mt-1 text-[10px] text-slate-400">{update.actor?.nombre || selected.responsible?.nombre}</p></div></li>)}</ol></div>
        </div>}
      </div>
    </div>

    {createOpen ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setCreateOpen(false); }}><form onSubmit={submitCreate} role="dialog" aria-modal="true" aria-labelledby="new-warranty-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><h3 id="new-warranty-title" className="text-lg font-semibold text-slate-900">{copy.newCase}</h3><p className="mt-1 text-xs text-slate-500">{copy.currentUser} <strong>{adminProfile?.nombre || user?.email}</strong></p></div><button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={19} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {copy.selectVilla} <span className="text-brand-500">*</span>
        </label>
        <WarrantyProjectSelect
          projects={projects}
          value={createForm.project_id}
          onChange={(projectId, project) => chooseProject(projectId, project)}
          locale={locale}
          placeholder={copy.noVilla}
          required
        />
      </div>
      <label className="text-xs font-medium text-slate-600">{copy.equipment}<input required value={createForm.equipment} onChange={event => setCreateForm(current => ({ ...current, equipment: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" /></label>
      <label className="text-xs font-medium text-slate-600">{copy.serial} <span className="font-normal text-slate-400">({copy.optional})</span><input value={createForm.serial_number} onChange={event => setCreateForm(current => ({ ...current, serial_number: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" /></label>
      <label className="text-xs font-medium text-slate-600">{copy.macAddress} <span className="font-normal text-slate-400">({copy.optional})</span><input value={createForm.mac_address} onChange={event => setCreateForm(current => ({ ...current, mac_address: event.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" autoCapitalize="characters" spellCheck={false} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-brand-500" /></label>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {copy.deadline} <span className="font-normal text-slate-400">({copy.optional})</span>
        </label>
        <WarrantyDatePicker
          value={createForm.warranty_until}
          onChange={val => setCreateForm(current => ({ ...current, warranty_until: val }))}
          locale={locale}
        />
      </div>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">{copy.issue}<textarea required rows={4} value={createForm.issue} onChange={event => setCreateForm(current => ({ ...current, issue: event.target.value }))} placeholder={copy.issuePlaceholder} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-brand-500" /></label>
      {formError ? <p role="alert" className="text-xs text-orange-700 sm:col-span-2">{formError}</p> : null}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">{copy.cancel}</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><CheckCircle2 size={16} />{saving ? copy.creating : copy.create}</button></div></form></div> : null}
  </section>;
}
