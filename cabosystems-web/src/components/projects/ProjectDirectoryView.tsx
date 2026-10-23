import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Building2, ChevronRight, Loader2, Plus, RefreshCw, Search, Settings2, X } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { getRoleLabel } from '../../lib/uiTranslations';
import { PROJECT_COPY, projectError } from '../../lib/projectAccessCopy';
import type { ProjectCopy } from '../../lib/projectAccessCopy';
import { createDevelopment, createVilla, getProjectDirectory, grantProjectAccess, revokeProjectAccess, saveProjectTeam } from '../../lib/projectAccessApi';
import type { Development, ProjectDirectory, ProjectVilla } from '../../types/projectAccess';
import type { Profile } from '../../types/fleet';
import { AppSelect } from '../ui/AppSelect';
import { useDialog } from '../ui/useDialog';
import './ProjectDirectory.css';
import { useSectionResources, type SectionResources } from '../../context/SectionResources';

export const prefetchDirectory = (resources: SectionResources, admin: boolean) => resources.queries.load(`directory:${admin}`, () => getProjectDirectory(admin));

const EMPTY: ProjectDirectory = { developments: [], villas: [], members: [], staff: [], globalGrants: [], developmentGrants: [] };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const personName = (person: Profile) => person.nombre || person.full_name || person.id.slice(0, 8);

function ProjectModal({ title, close, children, c, busy = false }: { title: string; close: () => void; children: ReactNode; c: ProjectCopy; busy?: boolean }) {
  const ref = useDialog<HTMLDivElement>(true, () => { if (!busy) close(); });
  const titleId = 'project-dialog-title';
  return createPortal(<div className="pd-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="pd-modal">
      <header><h2 id={titleId}>{title}</h2><button type="button" className="pd-icon" aria-label={c.close} disabled={busy} onClick={close}><X size={20} /></button></header>{children}
    </div>
  </div>, document.body);
}

function CreateLocation({ development, c, close, created }: { development?: Development; c: ProjectCopy; close: () => void; created: (developmentId: string, villaId?: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !name.trim()) return; setBusy(true); setError('');
    try {
      if (development) { const villa = await createVilla(development, name, description); await created(development.id, villa.id); }
      else { const record = await createDevelopment(name); await created(record.id); }
      close();
    } catch (err) { setError(projectError(err, c)); } finally { setBusy(false); }
  };
  return <ProjectModal title={development ? c.newVilla : c.newDevelopment} c={c} close={close} busy={busy}>
    <form onSubmit={event => void submit(event)} className="pd-form">
      {development && <p className="pd-muted">{development.nombre}</p>}
      <label>{development ? c.villaName : c.developmentName}<input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      {development && <label>{c.description}<textarea rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>}
      {error && <p role="alert" className="pd-error">{error}</p>}
      <footer><button type="button" className="pd-button" disabled={busy} onClick={close}>{c.cancel}</button><button type="submit" className="pd-primary" disabled={busy || !name.trim()}>{busy ? c.saving : c.create}</button></footer>
    </form>
  </ProjectModal>;
}

function AccessSettings({ development, data, c, close, changed }: { development?: Development; data: ProjectDirectory; c: ProjectCopy; close: () => void; changed: () => Promise<void> }) {
  const { t } = useTranslation();
  const grants = development ? data.developmentGrants.filter(g => g.desarrollo_id === development.id) : data.globalGrants;
  const assigned = new Set(grants.map(g => g.usuario_id));
  const [query, setQuery] = useState(''); const [personId, setPersonId] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const available = data.staff.filter(p => p.activo && p.rol !== 'admin' && !assigned.has(p.id) && normalize(personName(p)).includes(normalize(query)));
  const grantPeople = data.staff.filter(p => p.rol === 'admin' || assigned.has(p.id));
  const change = async (userId: string, grant: boolean) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { if (grant) await grantProjectAccess(userId, development?.id); else await revokeProjectAccess(userId, development?.id); await changed(); setPersonId(''); setNotice(grant ? c.granted : c.revoked); }
    catch (err) { setError(projectError(err, c)); } finally { setBusy(false); }
  };
  return <ProjectModal title={development ? `${c.developmentAccess} · ${development.nombre}` : c.globalAccess} c={c} close={close} busy={busy}>
    <div className="pd-form"><p className="pd-muted">{development ? c.developmentHelp : c.globalHelp}</p>
      <label>{c.peopleSearch}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPersonId(''); }} /></label>
      <div className="pd-add-row"><AppSelect aria-label={c.grant} value={personId} onChange={event => setPersonId(event.target.value)} disabled={busy}><option value="">{c.unassigned}</option>{available.map(p => <option key={p.id} value={p.id}>{personName(p)} · {getRoleLabel(p.rol || '', t)}</option>)}</AppSelect><button className="pd-primary" type="button" disabled={busy || !personId || !available.some(p => p.id === personId)} onClick={() => void change(personId, true)}>{c.grant}</button></div>
      <div className="pd-people">{grantPeople.map(p => <div key={p.id} className="pd-person"><div><strong>{personName(p)}</strong><span>{p.rol === 'admin' ? c.administrator : getRoleLabel(p.rol || '', t)}</span></div>{p.rol !== 'admin' && <button className="pd-button" type="button" disabled={busy} onClick={() => void change(p.id, false)} aria-label={`${c.removeAccess}: ${personName(p)}`}>{c.remove}</button>}</div>)}{grants.length === 0 && <p className="pd-muted">{c.noGrants}</p>}</div>
      <p className="pd-muted pd-help">{c.revokeHelp}</p>{error && <p role="alert" className="pd-error">{error}</p>}<p role="status" className="pd-notice">{notice}</p>
    </div>
  </ProjectModal>;
}

function VillaTeam({ villa, data, admin, c, close, saved, onDirty }: { villa: ProjectVilla; data: ProjectDirectory; admin: boolean; c: ProjectCopy; close: () => void; saved: () => Promise<void>; onDirty: (dirty: boolean) => void }) {
  const { t } = useTranslation();
  const initial = data.members.filter(m => m.proyecto_id === villa.id).map(m => m.usuario_id);
  const [integrator, setIntegrator] = useState(villa.integrador_id || ''); const [technician, setTechnician] = useState(villa.tecnico_id || '');
  const [participants, setParticipants] = useState(initial); const [personId, setPersonId] = useState(''); const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const dirty = integrator !== (villa.integrador_id || '') || technician !== (villa.tecnico_id || '') || [...participants].sort().join() !== [...initial].sort().join();
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const active = data.staff.filter(p => p.activo);
  const available = active.filter(p => !participants.includes(p.id) && p.id !== integrator && p.id !== technician && normalize(personName(p)).includes(normalize(query)));
  const labelFor = (id: string) => { const p = data.staff.find(person => person.id === id); return p ? personName(p) : c.unassigned; };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!dirty || busy) return; setBusy(true); setError(''); setNotice('');
    try { await saveProjectTeam(villa, integrator, technician, participants); onDirty(false); await saved(); setNotice(c.saved); }
    catch (err) { setError(projectError(err, c)); } finally { setBusy(false); }
  };
  return <aside className="pd-detail" aria-label={`${c.participants}: ${villa.villa}`}>
    <header><div><p className="pd-muted">{villa.desarrollo}</p><h2>{villa.villa}</h2></div><button type="button" className="pd-icon" aria-label={c.close} disabled={busy} onClick={close}><X size={20} /></button></header>
    <form className="pd-team pd-form" onSubmit={event => void save(event)}>
      {villa.descripcion && <p className="pd-description">{villa.descripcion}</p>}
      {admin ? <>{[{ label: c.integrator, value: integrator, set: setIntegrator }, { label: c.technician, value: technician, set: setTechnician }].map(({ label, value, set }) => <label key={label}>{label}<AppSelect aria-label={label} value={value} disabled={busy} onChange={event => set(event.target.value)}><option value="">{c.unassigned}</option>{active.map(p => <option key={p.id} value={p.id}>{personName(p)} · {getRoleLabel(p.rol || '', t)}</option>)}{value && !active.some(p => p.id === value) && <option value={value}>{labelFor(value)}</option>}</AppSelect></label>)}</>
        : <dl className="pd-leads"><dt>{c.integrator}</dt><dd>{labelFor(integrator)}</dd><dt>{c.technician}</dt><dd>{labelFor(technician)}</dd></dl>}
      <section className="pd-participants"><h3>{c.participants} <span>{participants.length}</span></h3>
        {participants.length ? participants.map(id => <div className="pd-person" key={id}><div><strong>{labelFor(id)}</strong><span>{getRoleLabel(data.staff.find(p => p.id === id)?.rol || '', t)}</span></div>{admin && <button type="button" className="pd-icon" aria-label={`${c.remove}: ${labelFor(id)}`} disabled={busy} onClick={() => setParticipants(previous => previous.filter(member => member !== id))}><X size={16} /></button>}</div>) : <p className="pd-muted">{c.noParticipants}</p>}
        {admin && <div className="pd-add-person"><label>{c.peopleSearch}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPersonId(''); }} disabled={busy} /></label><div className="pd-add-row"><AppSelect aria-label={c.addParticipant} value={personId} disabled={busy} onChange={event => setPersonId(event.target.value)}><option value="">{c.addParticipant}</option>{available.map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}</AppSelect><button type="button" className="pd-icon" aria-label={c.addParticipant} disabled={busy || !personId || !available.some(p => p.id === personId)} onClick={() => { setParticipants(previous => [...previous, personId]); setPersonId(''); setQuery(''); }}><Plus size={18} /></button></div></div>}
      </section>
      <p className="pd-muted pd-help">{c.inheritedHelp}</p>
      {error && <p role="alert" className="pd-error">{error}<button type="button" className="pd-text-button" disabled={busy} onClick={() => { if (window.confirm(c.unsaved)) { onDirty(false); void saved(); } }}>{c.reload}</button></p>}
      <p role="status" className="pd-notice">{notice}</p>
      {admin && <footer><button type="submit" className="pd-primary" disabled={!dirty || busy}>{busy ? c.saving : c.save}</button></footer>}
    </form>
  </aside>;
}

export function ProjectDirectoryView() {
  const { adminProfile } = useAdminAuth(); const admin = adminProfile?.rol === 'admin' && adminProfile.activo === true;
  const { language } = useTranslation(); const c = PROJECT_COPY[language];
  const resources = useSectionResources();
  const cached = resources.queries.read<ProjectDirectory>(`directory:${admin}`);
  const [data, setData] = useState(cached || EMPTY); const [loading, setLoading] = useState(!cached); const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''); const [developmentId, setDevelopmentId] = useState(''); const [villaId, setVillaId] = useState('');
  const [notice, setNotice] = useState(''); const [editorVersion, setEditorVersion] = useState(0);
  const [developmentSearch, setDevelopmentSearch] = useState(''); const [query, setQuery] = useState('');
  const [creation, setCreation] = useState<'development' | 'villa' | null>(null); const [access, setAccess] = useState<'global' | 'development' | null>(null);
  const request = useRef(0); const dirty = useRef(false); const setDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const hasLoaded = useRef(Boolean(cached));
  const canLeave = () => { if (!dirty.current) { setNotice(''); return true; } if (!window.confirm(c.unsaved)) return false; dirty.current = false; setNotice(''); setEditorVersion(previous => previous + 1); return true; };
  const load = useCallback(async (initial = false) => {
    const version = ++request.current; if (initial && !hasLoaded.current) setLoading(true); else setRefreshing(true);
    try { const next = await resources.queries.load(`directory:${admin}`, () => getProjectDirectory(admin), !initial); if (version !== request.current) return; setData(next); hasLoaded.current = true; setError(''); }
    catch { if (version === request.current) setError(c.loadFailed); }
    finally { if (version === request.current) { setLoading(false); setRefreshing(false); resources.markReady(); } }
  }, [admin, c.loadFailed, resources]);
  const invalidateRequests = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled && !dirty.current) void load(true); });
    return () => { cancelled = true; invalidateRequests(); };
  }, [load, invalidateRequests]);
  useEffect(() => {
    const refresh = () => { if (!dirty.current) void load(); };
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('focus', refresh); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('beforeunload', unload); };
  }, [load]);
  const development = data.developments.find(d => d.id === developmentId);
  const selectedVilla = data.villas.find(v => v.id === villaId && v.desarrollo_id === development?.id && v.estatus === 'activo');
  const active = useMemo(() => data.villas.filter(v => v.estatus === 'activo'), [data.villas]);
  const developments = data.developments.filter(d => normalize(d.nombre).includes(normalize(developmentSearch)));
  const villas = active.filter(v => v.desarrollo_id === development?.id && normalize(`${v.villa} ${v.descripcion || ''}`).includes(normalize(query))).sort((a, b) => a.villa.localeCompare(b.villa, language, { numeric: true }));
  const counts = useMemo(() => { const map = new Map<string, number>(); for (const villa of active) map.set(villa.desarrollo_id, (map.get(villa.desarrollo_id) || 0) + 1); return map; }, [active]);
  const changed = async () => { resources.queries.invalidate('tasks'); await load(); };
  const created = async (development: string, villa?: string) => { resources.queries.invalidate('tasks'); setDevelopmentId(development); setVillaId(villa || ''); setQuery(''); setDevelopmentSearch(''); await load(); };
  if (loading) return <div className="operational-panel pd-loading" role="status"><Loader2 size={24} className="animate-spin" />{c.loading}</div>;
  return <section className={`project-directory operational-panel ${development ? 'pd-has-development' : ''} ${selectedVilla ? 'pd-has-villa' : ''}`} aria-label={c.projects}>
    {error && <div className="pd-error pd-load-error" role="alert">{error}<button className="pd-button" disabled={refreshing} onClick={() => void load()}>{c.retry}</button></div>}
    {notice && <p className="pd-saved-notice" role="status">{notice}</p>}
    <div className="pd-layout">
      <aside className="pd-developments" aria-label={c.developments}>
        <header><h2>{c.developments}</h2><button type="button" className="pd-icon" aria-label={c.reload} disabled={refreshing} onClick={() => { if (canLeave()) void load(); }}><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button></header>
        {admin && <div className="pd-development-actions"><button className="pd-primary" type="button" onClick={() => { if (canLeave()) setCreation('development'); }}><Plus size={16} />{c.newDevelopment}</button><button className="pd-button" type="button" onClick={() => setAccess('global')}><Settings2 size={16} />{c.globalAccess}</button></div>}
        <label className="pd-search"><Search size={16} /><input type="search" aria-label={c.searchDevelopments} placeholder={c.searchDevelopments} value={developmentSearch} onChange={event => setDevelopmentSearch(event.target.value)} /></label>
        <div className="pd-development-list">{developments.map(d => <button key={d.id} type="button" aria-pressed={d.id === developmentId} className="pd-development" onClick={() => { if (canLeave()) { setDevelopmentId(d.id); setVillaId(''); setQuery(''); } }}><Building2 size={17} /><span>{d.nombre}</span><span className="pd-count">{counts.get(d.id) || 0}</span><ChevronRight size={15} /></button>)}{!developments.length && <p className="pd-empty">{data.developments.length ? c.noMatches : c.emptyDevelopments}</p>}</div>
      </aside>
      <div className="pd-villas">
        {development ? <><header><div><button type="button" className="pd-mobile-back" onClick={() => { if (canLeave()) { setDevelopmentId(''); setVillaId(''); } }}><ArrowLeft size={16} />{c.developments}</button><h2>{development.nombre}</h2><p className="pd-muted">{c.activeVillas} · {counts.get(development.id) || 0}</p></div>{admin && <button type="button" className="pd-icon" aria-label={c.developmentAccess} title={c.developmentAccess} onClick={() => setAccess('development')}><Settings2 size={18} /></button>}</header>
          <div className="pd-villa-tools"><label className="pd-search"><Search size={16} /><input type="search" aria-label={c.search} placeholder={c.search} value={query} onChange={event => setQuery(event.target.value)} /></label>{admin && <button className="pd-primary" type="button" onClick={() => { if (canLeave()) setCreation('villa'); }}><Plus size={16} />{c.newVilla}</button>}</div>
          <div className="pd-villa-grid">{villas.map(villa => <button className={`pd-villa ${villa.id === villaId ? 'is-selected' : ''}`} type="button" key={villa.id} aria-pressed={villa.id === villaId} onClick={() => { if (canLeave()) setVillaId(villa.id); }}><div><h3>{villa.villa}</h3><ChevronRight size={17} /></div>{villa.descripcion && <p>{villa.descripcion}</p>}<dl><dt>{c.integrator}</dt><dd>{data.staff.find(p => p.id === villa.integrador_id)?.nombre || c.unassigned}</dd><dt>{c.technician}</dt><dd>{data.staff.find(p => p.id === villa.tecnico_id)?.nombre || c.unassigned}</dd></dl></button>)}{!villas.length && <div className="pd-empty"><p>{query ? c.emptySearch : c.emptyVillas}</p><p className="pd-muted pd-help">{c.viewInactive}</p></div>}</div>
        </> : <div className="pd-empty pd-select-empty"><Building2 size={28} /><p>{c.chooseDevelopment}</p></div>}
      </div>
      {selectedVilla && <VillaTeam key={`${selectedVilla.id}:${selectedVilla.equipo_revision}:${editorVersion}`} villa={selectedVilla} data={data} admin={admin} c={c} close={() => { if (canLeave()) setVillaId(''); }} saved={async () => { await changed(); setNotice(c.saved); }} onDirty={setDirty} />}
    </div>
    {creation && admin && <CreateLocation c={c} development={creation === 'villa' ? development : undefined} close={() => setCreation(null)} created={created} />}
    {access && admin && <AccessSettings c={c} development={access === 'development' ? development : undefined} data={data} close={() => setAccess(null)} changed={changed} />}
  </section>;
}
