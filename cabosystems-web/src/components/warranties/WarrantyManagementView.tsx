import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronRight, CircleDashed,
  Clock3, Loader2, PackageCheck, Plus, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useSidebar } from '../../context/SidebarContext';
import { supabase } from '../../lib/supabase';
import {
  createWarrantyCase, deleteWarrantyCase, getWarrantyCases, getWarrantyProjects, updateWarrantyCase,
  warrantyFolio, type WarrantyArea, type WarrantyCase, type WarrantyProject,
  type WarrantyStatus,
} from '../../lib/warrantyApi';
import { allowedWarrantyStatuses, isClosedWarrantyStatus } from '../../lib/warrantyWorkflow';
import { AppSelect } from '../ui/AppSelect';
import { WarrantyDatePicker } from './WarrantyDatePicker';
import { WarrantyProjectSelect } from './WarrantyProjectSelect';

type Filter = 'all' | 'open' | 'waiting' | 'closed';

const managementAreas: WarrantyArea[] = ['operations', 'supplier'];
let warrantyChannelSequence = 0;

const labels = {
  es: {
    title: 'Control de garantías', subtitle: 'Casos claros, responsables visibles y seguimiento en un solo lugar.',
    newCase: 'Nueva garantía', search: 'Buscar folio, villa, área, equipo o serie…', all: 'Todos', open: 'Abiertos', waiting: 'En revisión', closed: 'Cerrados',
    registered: 'Registrada', review: 'Gestionando solicitud', statusWaiting: 'Solicitud enviada / en revisión', resolved: 'Garantía aprobada · Cerrada', rejected: 'Sin garantía · Cerrada',
    project: 'Proyecto', laboratory: 'Laboratorio', operations: 'Compras', supplier: 'Operaciones', client: 'Cliente',
    responsible: 'Responsable', noCases: 'No hay casos en esta vista', noCasesHint: 'Crea una garantía o cambia los filtros para ver otros casos.',
    caseData: 'Datos del caso', equipment: 'Equipo', serial: 'UID y/o serial', macAddress: 'MAC address', villa: 'Villa', villaArea: 'Área', villaAreaPlaceholder: 'Ej. Recámara principal, rack o terraza.', issue: 'Falla reportada', issuePlaceholder: 'Ej. El amplificador no enciende.', deadline: 'Fecha de inicio', noDeadline: 'Sin fecha de inicio',
    followUp: 'Actualizar seguimiento', newUpdate: 'Nuevo avance', stage: 'Etapa', managementRoute: 'Gestión por', note: 'Nota del avance', notePlaceholder: 'Registra el correo, respuesta o decisión para conservar el hilo completo.', save: 'Guardar avance', saving: 'Guardando…',
    closedCase: 'Caso cerrado. El historial queda disponible para consulta.',
    history: 'Historial', createdBy: 'Proceso levantado por', created: 'Caso registrado', cancel: 'Cancelar', create: 'Crear caso', creating: 'Creando…', deleteCase: 'Eliminar garantía', deleting: 'Eliminando…', deleteConfirm: '¿Eliminar {folio}? Esta acción también eliminará su historial y no se puede deshacer.', deleteError: 'No se pudo eliminar la garantía.',
    selectVilla: 'Villa', noVilla: 'Selecciona una villa', optional: 'Opcional', required: 'Completa los campos requeridos.', loadError: 'No se pudieron cargar las garantías.', saveError: 'No se pudo guardar el caso. Intenta de nuevo.',
    currentUser: 'Se asignará automáticamente a', today: 'Hoy', status: 'Estado', updated: 'Actualizado', selectCase: 'Selecciona un caso para consultar su seguimiento.',
  },
  en: {
    title: 'Warranty control', subtitle: 'Clear cases, visible ownership and follow-up in one place.',
    newCase: 'New warranty', search: 'Search folio, villa, area, equipment or serial…', all: 'All', open: 'Open', waiting: 'In review', closed: 'Closed',
    registered: 'Registered', review: 'Managing request', statusWaiting: 'Request sent / under review', resolved: 'Warranty approved · Closed', rejected: 'No warranty · Closed',
    project: 'Project', laboratory: 'Laboratory', operations: 'Purchasing', supplier: 'Operations', client: 'Client',
    responsible: 'Responsible', noCases: 'No cases in this view', noCasesHint: 'Create a warranty or change the filters to see other cases.',
    caseData: 'Case details', equipment: 'Equipment', serial: 'UID and/or serial', macAddress: 'MAC address', villa: 'Villa', villaArea: 'Area', villaAreaPlaceholder: 'E.g. Primary bedroom, rack or terrace.', issue: 'Reported issue', issuePlaceholder: 'E.g. The amplifier will not turn on.', deadline: 'Start date', noDeadline: 'No start date',
    followUp: 'Update follow-up', newUpdate: 'New update', stage: 'Stage', managementRoute: 'Managed by', note: 'Progress note', notePlaceholder: 'Record the email, response or decision to keep the complete thread.', save: 'Save update', saving: 'Saving…',
    closedCase: 'Case closed. The history remains available for reference.',
    history: 'History', createdBy: 'Process opened by', created: 'Case registered', cancel: 'Cancel', create: 'Create case', creating: 'Creating…', deleteCase: 'Delete warranty', deleting: 'Deleting…', deleteConfirm: 'Delete {folio}? This also deletes its history and cannot be undone.', deleteError: 'The warranty could not be deleted.',
    selectVilla: 'Villa', noVilla: 'Select a villa', optional: 'Optional', required: 'Complete the required fields.', loadError: 'Warranties could not be loaded.', saveError: 'The case could not be saved. Try again.',
    currentUser: 'Automatically assigned to', today: 'Today', status: 'Status', updated: 'Updated', selectCase: 'Select a case to review its follow-up.',
  },
} as const;

function statusLabel(copy: typeof labels.es | typeof labels.en, status: WarrantyStatus) {
  return status === 'waiting' ? copy.statusWaiting : copy[status];
}

function areaLabel(copy: typeof labels.es | typeof labels.en, area: WarrantyArea) {
  return copy[area];
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

function todayDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function warrantyLocation(item: WarrantyCase) {
  const location = item.location?.trim();
  if (!location || !item.project) return location || '';
  const projectLabels = [
    `${item.project.desarrollo} - ${item.project.villa}`,
    `${item.project.desarrollo} · ${item.project.villa}`,
  ];
  return projectLabels.includes(location) ? '' : location;
}

function StatusBadge({ status, copy, compact = false }: { status: WarrantyStatus; copy: typeof labels.es | typeof labels.en; compact?: boolean }) {
  return <span className={`inline-flex items-center rounded-full border font-semibold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${statusStyle(status)}`}>{statusLabel(copy, status)}</span>;
}

function ManagementRouteListbox({ value, onChange, copy, compact = false }: {
  value: WarrantyArea;
  onChange: (area: WarrantyArea) => void;
  copy: typeof labels.es | typeof labels.en;
  compact?: boolean;
}) {
  const height = compact ? 32 : 44;
  return <AppSelect aria-label={copy.managementRoute} value={value} onChange={event => onChange(event.target.value as WarrantyArea)} style={compact ? { height, minHeight: height, fontSize: 12 } : { height, minHeight: height }}>
    {managementAreas.map(area => <option key={area} value={area}>{areaLabel(copy, area)}</option>)}
  </AppSelect>;
}

/** Start-date field wrapper using the shared date picker with its inline Today action. */
function StartDateField({ value, onChange, locale, todayKey, copy, compact = false, className = '' }: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  todayKey: string;
  copy: typeof labels.es | typeof labels.en;
  compact?: boolean;
  className?: string;
}) {
  return <div className={`min-w-0 ${className}`}>
    <span className={`${compact ? 'mb-1 text-[11px]' : 'mb-1.5 text-xs'} block truncate font-medium text-slate-600`}>
      {copy.deadline} <span className="font-normal text-slate-400">({copy.optional})</span>
    </span>
    <WarrantyDatePicker
      compact={compact}
      value={value}
      onChange={onChange}
      locale={locale}
      todayKey={todayKey}
    />
  </div>;
}

export function WarrantyManagementView() {
  const { user, adminProfile } = useAdminAuth();
  const { language, locale } = useTranslation();
  const { warrantySearchQuery, setWarrantySearchQuery, warrantyCreateVersion } = useSidebar();
  const copy = labels[language === 'en' ? 'en' : 'es'];
  const todayKey = todayDateKey();
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [projects, setProjects] = useState<WarrantyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const createRequest = useRef(warrantyCreateVersion);
  const [createForm, setCreateForm] = useState({ project_id: '', location: '', equipment: '', serial_number: '', mac_address: '', issue: '', area: 'operations' as WarrantyArea, warranty_until: '', last_note: '' });
  const [updateForm, setUpdateForm] = useState({ status: 'registered' as WarrantyStatus, area: 'operations' as WarrantyArea, warranty_until: '', last_note: '' });

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
    setUpdateForm({ status: selected.status, area: managementAreas.includes(selected.area) ? selected.area : 'operations', warranty_until: selected.warranty_until || '', last_note: '' });
    setUpdateOpen(false);
    setFormError('');
  }, [selected?.id, selected?.status, selected?.area, selected?.warranty_until]);

  useEffect(() => {
    if (!updateOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setUpdateOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [updateOpen, saving]);

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
    setCreateForm({ project_id: '', location: '', equipment: '', serial_number: '', mac_address: '', issue: '', area: 'operations', warranty_until: '', last_note: '' });
    setFormError(''); setCreateOpen(true);
  }, []);

  useEffect(() => {
    if (createRequest.current === warrantyCreateVersion) return;
    createRequest.current = warrantyCreateVersion;
    openCreate();
  }, [warrantyCreateVersion, openCreate]);
  useEffect(() => () => setWarrantySearchQuery(''), [setWarrantySearchQuery]);

  const chooseProject = (projectId: string) => {
    setCreateForm(current => ({ ...current, project_id: projectId }));
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id || !createForm.project_id || !createForm.location.trim() || !createForm.equipment.trim() || !createForm.issue.trim()) { setFormError(copy.required); return; }
    setSaving(true); setFormError('');
    try {
      const created = await createWarrantyCase({ ...createForm, responsible_id: user.id });
      setCases(current => [created, ...current]); setSelectedId(created.id); setCreateOpen(false);
    } catch (saveError) { console.error('Warranty create failed:', saveError); setFormError(copy.saveError); }
    finally { setSaving(false); }
  };

  const openUpdate = () => {
    if (!selected) return;
    setUpdateForm({ status: selected.status, area: managementAreas.includes(selected.area) ? selected.area : 'operations', warranty_until: selected.warranty_until || '', last_note: '' });
    setFormError('');
    setUpdateOpen(true);
  };

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !updateForm.last_note.trim()) { setFormError(copy.required); return; }
    if (!allowedWarrantyStatuses(selected.status).includes(updateForm.status)) { setFormError(copy.saveError); return; }
    setSaving(true); setFormError('');
    try {
      const updated = await updateWarrantyCase(selected.id, updateForm);
      setCases(current => current.map(item => item.id === updated.id ? updated : item));
      setUpdateOpen(false);
    } catch (saveError) { console.error('Warranty update failed:', saveError); setFormError(copy.saveError); }
    finally { setSaving(false); }
  };

  const manager = Boolean(adminProfile?.rol && ['admin', 'supervisor_instalacion', 'aux_operaciones'].includes(adminProfile.rol));
  const hasVillaAccess = Boolean(selected?.project_id && projects.some(project => project.id === selected.project_id));
  const canUpdate = Boolean(selected && !isClosedWarrantyStatus(selected.status) && (selected.responsible_id === user?.id || manager || hasVillaAccess));
  const canDelete = Boolean(selected && (selected.responsible_id === user?.id || manager));

  const removeSelected = async () => {
    if (!selected || !canDelete || deleting) return;
    const folio = warrantyFolio(selected.case_number);
    if (!window.confirm(copy.deleteConfirm.replace('{folio}', folio))) return;
    setDeleting(true); setError('');
    try {
      await deleteWarrantyCase(selected.id);
      const remaining = cases.filter(item => item.id !== selected.id);
      setCases(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (deleteError) {
      console.error('Warranty delete failed:', deleteError);
      setError(copy.deleteError);
    } finally { setDeleting(false); }
  };

  return <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.15fr)]">
      <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-100 p-4">
          <div className="flex gap-1 overflow-x-auto" role="tablist">{(['all','open','waiting','closed'] as Filter[]).map(item => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{copy[item]} <span className={filter === item ? 'text-white/65' : 'text-slate-400'}>{counts[item]}</span></button>)}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? <div role="alert" className="m-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</div> : null}
          {loading ? <div className="space-y-1.5 p-1.5">{[0,1,2].map(item => <div key={item} className="h-[74px] animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
          {!loading && filtered.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center"><PackageCheck size={34} className="text-slate-300" /><h3 className="mt-3 text-sm font-semibold text-slate-700">{copy.noCases}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{copy.noCasesHint}</p></div> : null}
          {filtered.map(item => {
            const cardLocation = item.project ? warrantyLocation(item) : '';
            return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`mb-1 w-full rounded-xl border px-3 py-2 text-left transition-colors ${selectedId === item.id ? 'border-orange-300 bg-orange-50/60' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.status === 'waiting' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}><PackageCheck size={16} /></div>
               <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-[13px] font-semibold leading-tight text-slate-900">{item.equipment}</p>{cardLocation ? <span title={cardLocation} className="max-w-[45%] shrink-0 truncate text-[11px] font-medium text-slate-400">{cardLocation}</span> : null}</div><p className="mt-0.5 truncate text-xs leading-tight text-slate-500">{item.project ? `${item.project.desarrollo} - ${item.project.villa}` : item.location}</p><div className="mt-1.5 flex items-center justify-between gap-2"><StatusBadge compact status={item.status} copy={copy} /><span className="truncate text-[11px] text-slate-500">{item.responsible?.nombre || copy.responsible}</span></div></div>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </div>
          </button>;
          })}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto bg-slate-50/45">
        {!selected ? <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 text-center"><ShieldCheck size={38} className="text-slate-300" /><p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">{copy.selectCase}</p></div> : <div className="flex min-h-full flex-col gap-3 p-4 lg:h-full">
          <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.villa}</p><p title={selected.project ? `${selected.project.desarrollo} - ${selected.project.villa}` : undefined} className="mt-0.5 truncate text-sm font-semibold text-slate-800">{selected.project ? `${selected.project.desarrollo} - ${selected.project.villa}` : '—'}</p></div>
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.serial}</p><p title={selected.serial_number || undefined} className="mt-0.5 truncate text-sm font-semibold text-slate-800">{selected.serial_number || '—'}</p></div>
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.macAddress}</p><p className="mt-0.5 truncate font-mono text-sm font-semibold text-slate-800">{selected.mac_address || '—'}</p></div>
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.responsible}</p><p title={selected.responsible?.nombre || undefined} className="mt-0.5 truncate text-sm font-semibold text-slate-800">{selected.responsible?.nombre || '—'}</p></div>
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.villaArea}</p><p title={warrantyLocation(selected) || undefined} className="mt-0.5 truncate text-sm font-semibold text-slate-800">{warrantyLocation(selected) || '—'}</p></div>
            <div className="bg-white px-4 py-2.5"><p className="text-[11px] font-medium text-slate-400">{copy.deadline}</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{selected.warranty_until ? formatDate(`${selected.warranty_until}T12:00:00`, locale) : copy.noDeadline}</p></div>
          </div>
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-[11px] font-semibold text-slate-400">{copy.issue}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.issue}</p></div>

          <div id="warranty-history-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-800">{copy.history}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{selected.updates.length}</span>
                <StatusBadge compact status={selected.status} copy={copy} />
              </div>
              <div className="flex items-center gap-2">
                {canUpdate ? <button type="button" onClick={openUpdate} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"><Plus size={14} />{copy.newUpdate}</button> : null}
                {canDelete ? <button type="button" disabled={deleting} onClick={() => void removeSelected()} aria-label={deleting ? copy.deleting : copy.deleteCase} title={deleting ? copy.deleting : copy.deleteCase} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50">{deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button> : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ol className="space-y-0">{selected.updates.map((update, index) => <li key={update.id} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-500">{index === 0 ? <Clock3 size={14} /> : <CircleDashed size={14} />}</div>{index < selected.updates.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-28px)] w-px bg-slate-200" /> : null}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">{statusLabel(copy, update.status)}</p><time className="text-[10px] text-slate-400">{formatDate(update.created_at, locale, true)}</time></div>{update.note ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{update.note}</p> : null}<p className="mt-1 text-[10px] text-slate-400">{areaLabel(copy, update.area)} · {update.actor?.nombre || selected.responsible?.nombre}</p></div></li>)}</ol>
            </div>
            {isClosedWarrantyStatus(selected.status) ? <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600"><CheckCircle2 size={15} className="shrink-0 text-slate-700" />{copy.closedCase}</div> : null}
          </div>
        </div>}
      </div>
    </div>

    {updateOpen && selected && canUpdate ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setUpdateOpen(false); }}><form onSubmit={submitUpdate} role="dialog" aria-modal="true" aria-labelledby="update-warranty-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><h3 id="update-warranty-title" className="text-lg font-semibold text-slate-900">{copy.followUp}</h3><p className="mt-0.5 text-xs text-slate-500">{warrantyFolio(selected.case_number)} · {selected.equipment}</p></div><button type="button" disabled={saving} onClick={() => setUpdateOpen(false)} aria-label={copy.cancel} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={19} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2">
      <div><p className="mb-1.5 text-xs font-medium text-slate-600">{copy.stage}</p><AppSelect aria-label={copy.stage} value={updateForm.status} onChange={event => setUpdateForm(current => ({ ...current, status: event.target.value as WarrantyStatus }))} style={{ height: 44, minHeight: 44 }}>{allowedWarrantyStatuses(selected.status).map(status => <option key={status} value={status}>{statusLabel(copy, status)}</option>)}</AppSelect></div>
      <div><p className="mb-1.5 text-xs font-medium text-slate-600">{copy.managementRoute}</p><ManagementRouteListbox value={updateForm.area} onChange={area => setUpdateForm(current => ({ ...current, area }))} copy={copy} /></div>
      <StartDateField className="sm:col-span-2" value={updateForm.warranty_until} onChange={val => setUpdateForm(current => ({ ...current, warranty_until: val }))} locale={locale} todayKey={todayKey} copy={copy} />
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">{copy.note}<textarea required rows={4} value={updateForm.last_note} onChange={event => setUpdateForm(current => ({ ...current, last_note: event.target.value }))} placeholder={copy.notePlaceholder} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-5 outline-none focus:border-brand-500" /></label>
      {formError ? <p role="alert" className="text-xs text-orange-700 sm:col-span-2">{formError}</p> : null}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button type="button" disabled={saving} onClick={() => setUpdateOpen(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">{copy.cancel}</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><CheckCircle2 size={16} />{saving ? copy.saving : copy.save}</button></div></form></div> : null}

    {createOpen ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setCreateOpen(false); }}><form onSubmit={submitCreate} role="dialog" aria-modal="true" aria-labelledby="new-warranty-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><h3 id="new-warranty-title" className="text-lg font-semibold text-slate-900">{copy.newCase}</h3><p className="mt-1 text-xs text-slate-500">{copy.currentUser} <strong>{adminProfile?.nombre || user?.email}</strong></p></div><button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={19} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {copy.selectVilla} <span className="text-brand-500">*</span>
        </label>
        <WarrantyProjectSelect
          projects={projects}
          value={createForm.project_id}
          onChange={projectId => chooseProject(projectId)}
          locale={locale}
          placeholder={copy.noVilla}
          required
        />
      </div>
      <label className="text-xs font-medium text-slate-600">{copy.villaArea} <span className="text-brand-500">*</span><input required value={createForm.location} onChange={event => setCreateForm(current => ({ ...current, location: event.target.value }))} placeholder={copy.villaAreaPlaceholder} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500" /></label>
      <label className="text-xs font-medium text-slate-600">{copy.equipment}<input required value={createForm.equipment} onChange={event => setCreateForm(current => ({ ...current, equipment: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" /></label>
      <label className="text-xs font-medium text-slate-600">{copy.serial} <span className="font-normal text-slate-400">({copy.optional})</span><input value={createForm.serial_number} onChange={event => setCreateForm(current => ({ ...current, serial_number: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" /></label>
      <label className="text-xs font-medium text-slate-600">{copy.macAddress} <span className="font-normal text-slate-400">({copy.optional})</span><input value={createForm.mac_address} onChange={event => setCreateForm(current => ({ ...current, mac_address: event.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" autoCapitalize="characters" spellCheck={false} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-brand-500" /></label>
      <div><p className="mb-1.5 text-xs font-medium text-slate-600">{copy.managementRoute}</p><ManagementRouteListbox value={createForm.area} onChange={area => setCreateForm(current => ({ ...current, area }))} copy={copy} /></div>
      <StartDateField value={createForm.warranty_until} onChange={val => setCreateForm(current => ({ ...current, warranty_until: val }))} locale={locale} todayKey={todayKey} copy={copy} />
      <label className="text-xs font-medium text-slate-600 sm:col-span-2">{copy.issue}<textarea required rows={4} value={createForm.issue} onChange={event => setCreateForm(current => ({ ...current, issue: event.target.value }))} placeholder={copy.issuePlaceholder} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-brand-500" /></label>
      {formError ? <p role="alert" className="text-xs text-orange-700 sm:col-span-2">{formError}</p> : null}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">{copy.cancel}</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><CheckCircle2 size={16} />{saving ? copy.creating : copy.create}</button></div></form></div> : null}
  </section>;
}
