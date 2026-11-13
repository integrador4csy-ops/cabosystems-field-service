import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Building2, Check, ChevronDown, ChevronRight, ListFilter, LocateFixed, Loader2, MapPin, Plus, RefreshCw, Settings2, Trash2, UserRoundCog, Users, X } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { getRoleLabel } from '../../lib/uiTranslations';
import { PROJECT_COPY, projectError } from '../../lib/projectAccessCopy';
import type { ProjectCopy } from '../../lib/projectAccessCopy';
import { createDevelopment, createVilla, deleteDevelopment, deleteVilla, getProjectDirectory, grantProjectAccess, revokeProjectAccess, saveProjectTeam, updateVillaDetails, updateVillaGeofence } from '../../lib/projectAccessApi';
import type { Development, ProjectDirectory, ProjectVilla } from '../../types/projectAccess';
import type { Profile } from '../../types/fleet';
import { AppSelect } from '../ui/AppSelect';
import { useDialog } from '../ui/useDialog';
import { useSidebar } from '../../context/SidebarContext';
import { VillaGeofenceMap } from './VillaGeofenceMap';
import './ProjectDirectory.css';
import { useSectionResources, type SectionResources } from '../../context/SectionResources';
import { isEligibleProjectLead } from '../../lib/projectTeamRoles';

export const prefetchDirectory = (resources: SectionResources, admin: boolean) => resources.queries.load(`directory:${admin}`, () => getProjectDirectory(admin));

const EMPTY: ProjectDirectory = { developments: [], villas: [], members: [], staff: [], globalGrants: [], developmentGrants: [] };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const personName = (person: Profile) => person.nombre || person.full_name || person.id.slice(0, 8);
type VillaDetailTab = 'team' | 'participants' | 'location';
const PROJECT_STATUSES: ProjectVilla['estatus'][] = ['activo', 'pausado', 'en_conciliacion', 'finalizado'];

function projectStatusLabel(c: ProjectCopy, status: ProjectVilla['estatus']) {
  if (status === 'activo') return c.active;
  if (status === 'pausado') return c.paused;
  if (status === 'en_conciliacion') return c.reconciliation;
  return c.completed;
}

function ProjectModal({ title, close, children, c, busy = false, className = '', role = 'dialog', descriptionId }: { title: string; close: () => void; children: ReactNode; c: ProjectCopy; busy?: boolean; className?: string; role?: 'dialog' | 'alertdialog'; descriptionId?: string }) {
  const ref = useDialog<HTMLDivElement>(true, () => { if (!busy) close(); });
  const titleId = 'project-dialog-title';
  return createPortal(<div className="pd-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div ref={ref} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className={`pd-modal ${className}`}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="pd-icon" aria-label={c.close} disabled={busy} onClick={close}><X size={20} /></button></header>{children}
    </div>
  </div>, document.body);
}

function DeleteDevelopmentDialog({ development, c, busy, error, close, confirm }: { development: Development; c: ProjectCopy; busy: boolean; error: string; close: () => void; confirm: () => void }) {
  const descriptionId = 'delete-development-description';
  return <ProjectModal title={c.deleteDevelopment} c={c} close={close} busy={busy} className="pd-delete-modal" role="alertdialog" descriptionId={descriptionId}>
    <div className="pd-delete-confirm">
      <div className="pd-delete-intro">
        <div className="pd-delete-symbol" aria-hidden="true"><Trash2 size={21} /></div>
        <div>
          <p className="pd-delete-question">{c.deleteDevelopmentQuestion.replace('{name}', development.nombre)}</p>
          <p id={descriptionId} className="pd-delete-warning">{c.deleteDevelopmentWarning}</p>
        </div>
      </div>
      {error && <p role="alert" className="pd-delete-error">{error}</p>}
      <footer>
        <button type="button" className="pd-button" disabled={busy} onClick={close}>{c.cancel}</button>
        <button type="button" className="pd-delete-button" disabled={busy} onClick={confirm}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {busy ? c.deletingDevelopment : c.deleteDevelopment}
        </button>
      </footer>
    </div>
  </ProjectModal>;
}

function DeleteVillaDialog({ villa, c, busy, error, close, confirm }: { villa: ProjectVilla; c: ProjectCopy; busy: boolean; error: string; close: () => void; confirm: () => void }) {
  const descriptionId = 'delete-villa-description';
  return <ProjectModal title={c.deleteVilla} c={c} close={close} busy={busy} className="pd-delete-modal" role="alertdialog" descriptionId={descriptionId}>
    <div className="pd-delete-confirm">
      <div className="pd-delete-intro"><div className="pd-delete-symbol" aria-hidden="true"><Trash2 size={21} /></div><div><p className="pd-delete-question">{c.deleteVillaQuestion.replace('{name}', villa.villa)}</p><p id={descriptionId} className="pd-delete-warning">{c.deleteVillaWarning}</p></div></div>
      {error && <p role="alert" className="pd-delete-error">{error}</p>}
      <footer><button type="button" className="pd-button" disabled={busy} onClick={close}>{c.cancel}</button><button type="button" className="pd-delete-button" disabled={busy} onClick={confirm}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{busy ? c.deletingVilla : c.deleteVilla}</button></footer>
    </div>
  </ProjectModal>;
}

function CreateLocation({ development, c, close, created }: { development?: Development; c: ProjectCopy; close: () => void; created: (developmentId: string, villaId?: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [projectNumber, setProjectNumber] = useState(''); const [client, setClient] = useState('');
  const [status, setStatus] = useState<ProjectVilla['estatus']>('activo');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !name.trim() || (development && (!projectNumber.trim() || !client.trim()))) return; setBusy(true); setError('');
    try {
      if (development) { const villa = await createVilla(development, { villa: name, numeroProyecto: projectNumber, cliente: client, descripcion: description, estatus: status }); await created(development.id, villa.id); }
      else { const record = await createDevelopment(name); await created(record.id); }
      close();
    } catch (err) { setError(projectError(err, c)); } finally { setBusy(false); }
  };
  return <ProjectModal title={development ? c.newVilla : c.newDevelopment} c={c} close={close} busy={busy}>
    <form onSubmit={event => void submit(event)} className="pd-form">
      {development && <p className="pd-muted">{development.nombre}</p>}
      <label>{development ? c.villaName : c.developmentName}<input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      {development && <div className="pd-create-grid">
        <label>{c.projectNumber}<input required maxLength={120} value={projectNumber} onChange={event => setProjectNumber(event.target.value)} /></label>
        <label>{c.projectStatus}<AppSelect value={status} onChange={event => setStatus(event.target.value as ProjectVilla['estatus'])}>{PROJECT_STATUSES.map(item => <option key={item} value={item}>{projectStatusLabel(c, item)}</option>)}</AppSelect></label>
        <label className="pd-create-wide">{c.client}<input required maxLength={200} value={client} onChange={event => setClient(event.target.value)} /></label>
      </div>}
      {development && <label>{c.description}<textarea rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>}
      {error && <p role="alert" className="pd-error">{error}</p>}
      <footer><button type="button" className="pd-button" disabled={busy} onClick={close}>{c.cancel}</button><button type="submit" className="pd-primary" disabled={busy || !name.trim() || Boolean(development && (!projectNumber.trim() || !client.trim()))}>{busy ? c.saving : c.create}</button></footer>
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

function VillaTeam({ villa, data, admin, c, close, saved, deleted, onDirty }: { villa: ProjectVilla; data: ProjectDirectory; admin: boolean; c: ProjectCopy; close: () => void; saved: () => Promise<void>; deleted: () => Promise<void>; onDirty: (dirty: boolean) => void }) {
  const { t } = useTranslation();
  const initialMembers = data.members.filter(m => m.proyecto_id === villa.id);
  const initial = initialMembers.map(m => m.usuario_id);
  const [integrator, setIntegrator] = useState(villa.integrador_id || ''); const [technician, setTechnician] = useState(villa.tecnico_id || '');
  const [villaName, setVillaName] = useState(villa.villa); const [projectNumber, setProjectNumber] = useState(villa.numero_proyecto || '');
  const [client, setClient] = useState(villa.cliente || ''); const [description, setDescription] = useState(villa.descripcion || '');
  const [status, setStatus] = useState<ProjectVilla['estatus']>(villa.estatus);
  const [latitude, setLatitude] = useState(villa.latitud == null ? '' : String(villa.latitud));
  const [longitude, setLongitude] = useState(villa.longitud == null ? '' : String(villa.longitud));
  const [radiusMeters, setRadiusMeters] = useState(String(villa.radio_geocerca_m || 150));
  const [gettingLocation, setGettingLocation] = useState(false);
  const [participants, setParticipants] = useState(initial);
  const [participantAccess, setParticipantAccess] = useState<Record<string, 'mis_tareas' | 'todas_las_tareas'>>(() => {
    const acc: Record<string, 'mis_tareas' | 'todas_las_tareas'> = {};
    for (const m of initialMembers) {
      acc[m.usuario_id] = m.tipo_acceso || 'mis_tareas';
    }
    return acc;
  });
  const [personId, setPersonId] = useState('');
  const [activeTab, setActiveTab] = useState<VillaDetailTab>('team');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState('');
  const accessSignature = participants.map(id => `${id}:${participantAccess[id] || 'mis_tareas'}`).sort().join();
  const initialAccessSignature = initialMembers.map(m => `${m.usuario_id}:${m.tipo_acceso || 'mis_tareas'}`).sort().join();
  const geofenceDirty = latitude !== (villa.latitud == null ? '' : String(villa.latitud)) || longitude !== (villa.longitud == null ? '' : String(villa.longitud)) || radiusMeters !== String(villa.radio_geocerca_m || 150);
  const detailsDirty = villaName.trim() !== villa.villa || projectNumber.trim() !== (villa.numero_proyecto || '') || client.trim() !== (villa.cliente || '') || description.trim() !== (villa.descripcion || '') || status !== villa.estatus;
  const teamDirty = integrator !== (villa.integrador_id || '') || technician !== (villa.tecnico_id || '') || accessSignature !== initialAccessSignature;
  const dirty = teamDirty || geofenceDirty || detailsDirty;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const active = data.staff.filter(p => p.activo);
  const integratorOptions = data.staff.filter(person => isEligibleProjectLead(person, 'integrator'));
  const technicianOptions = data.staff.filter(person => isEligibleProjectLead(person, 'technician'));
  const available = active.filter(p => !participants.includes(p.id) && p.id !== integrator && p.id !== technician);
  const labelFor = (id: string) => { const p = data.staff.find(person => person.id === id); return p ? personName(p) : c.unassigned; };
  const useCurrentLocation = () => {
    if (!navigator.geolocation || gettingLocation) return;
    setGettingLocation(true); setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGettingLocation(false);
      },
      () => { setError(c.locationReadFailed); setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!dirty || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const parsedLatitude = latitude.trim() === '' ? null : Number(latitude);
      const parsedLongitude = longitude.trim() === '' ? null : Number(longitude);
      const parsedRadius = Number(radiusMeters);
      const coordinatesComplete = parsedLatitude !== null && parsedLongitude !== null;
      if ((parsedLatitude === null) !== (parsedLongitude === null) || (coordinatesComplete && (!Number.isFinite(parsedLatitude) || Math.abs(parsedLatitude) > 90 || !Number.isFinite(parsedLongitude) || Math.abs(parsedLongitude) > 180)) || !Number.isInteger(parsedRadius) || parsedRadius < 25 || parsedRadius > 5000) {
        throw Object.assign(new Error(c.invalidGeofence), { code: 'INVALID_GEOFENCE' });
      }
      const allTasks = participants.filter(id => participantAccess[id] === 'todas_las_tareas');
      if (!villaName.trim()) throw Object.assign(new Error(c.villaName), { code: 'INVALID_VILLA_NAME' });
      if (detailsDirty) await updateVillaDetails(villa.id, { villa: villaName, numeroProyecto: projectNumber, cliente: client, descripcion: description, estatus: status });
      if (geofenceDirty) await updateVillaGeofence(villa.id, { latitude: parsedLatitude, longitude: parsedLongitude, radiusMeters: parsedRadius });
      if (teamDirty) await saveProjectTeam(villa, integrator, technician, participants, allTasks);
      onDirty(false); await saved(); setNotice(c.saved);
    }
    catch (err) { setError(projectError(err, c)); } finally { setBusy(false); }
  };
  const removeVilla = async () => {
    if (deleting) return; setDeleting(true); setDeleteError('');
    try { await deleteVilla(villa.id); setDeleteOpen(false); onDirty(false); await deleted(); }
    catch (err) { setDeleteError(projectError(err, c)); }
    finally { setDeleting(false); }
  };
  const tabs: Array<{ id: VillaDetailTab; label: string; icon: typeof Users; count?: number }> = [
    { id: 'team', label: c.teamTab, icon: UserRoundCog },
    { id: 'participants', label: c.participantsTab, icon: Users, count: participants.length },
    { id: 'location', label: c.locationTab, icon: MapPin },
  ];
  return <aside className="pd-detail" aria-label={`${c.participants}: ${villa.villa}`}>
    <header><div><p className="pd-muted">{villa.desarrollo}</p><h2>{villa.villa}</h2></div><button type="button" className="pd-icon" aria-label={c.close} disabled={busy} onClick={close}><X size={20} /></button></header>
    <div className="pd-detail-tabs" role="tablist" aria-label={c.villaSections}>
      {tabs.map(({ id, label, icon: Icon, count }) => <button
        key={id}
        id={`villa-tab-${id}`}
        type="button"
        role="tab"
        aria-selected={activeTab === id}
        aria-controls={`villa-panel-${id}`}
        disabled={busy}
        onClick={() => setActiveTab(id)}
      ><Icon size={15} /><span>{label}</span>{count !== undefined && <small>{count}</small>}</button>)}
    </div>
    <form className="pd-team pd-form" onSubmit={event => void save(event)}>
      {activeTab === 'team' && <section id="villa-panel-team" role="tabpanel" aria-labelledby="villa-tab-team" className="pd-tab-panel">
        {admin ? <div className="pd-villa-fields"><label className="pd-field-wide">{c.villaName}<input required maxLength={120} value={villaName} onChange={event => setVillaName(event.target.value)} disabled={busy} /></label><label>{c.projectNumber}<input maxLength={120} value={projectNumber} onChange={event => setProjectNumber(event.target.value)} disabled={busy} /></label><label>{c.client}<input maxLength={200} value={client} onChange={event => setClient(event.target.value)} disabled={busy} /></label><label className="pd-field-wide">{c.projectStatus}<AppSelect value={status} disabled={busy} onChange={event => setStatus(event.target.value as ProjectVilla['estatus'])}>{PROJECT_STATUSES.map(item => <option key={item} value={item}>{projectStatusLabel(c, item)}</option>)}</AppSelect></label><label className="pd-field-wide">{c.description}<textarea rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} /></label></div> : <>{(villa.numero_proyecto || villa.cliente) && <dl className="pd-leads pd-project-facts">{villa.numero_proyecto && <><dt>{c.projectNumber}</dt><dd>{villa.numero_proyecto}</dd></>}{villa.cliente && <><dt>{c.client}</dt><dd>{villa.cliente}</dd></>}<dt>{c.projectStatus}</dt><dd>{projectStatusLabel(c, villa.estatus)}</dd></dl>}{villa.descripcion && <p className="pd-description">{villa.descripcion}</p>}</>}
        {admin ? <>{[{ label: c.integrator, value: integrator, set: setIntegrator, options: integratorOptions }, { label: c.technician, value: technician, set: setTechnician, options: technicianOptions }].map(({ label, value, set, options }) => <label key={label}>{label}<AppSelect aria-label={label} value={value} disabled={busy} onChange={event => set(event.target.value)}><option value="">{c.unassigned}</option>{options.map(p => <option key={p.id} value={p.id}>{personName(p)} · {getRoleLabel(p.rol || '', t)}</option>)}{value && !options.some(p => p.id === value) && <option value={value}>{labelFor(value)}</option>}</AppSelect></label>)}</>
          : <dl className="pd-leads"><dt>{c.integrator}</dt><dd>{labelFor(integrator)}</dd><dt>{c.technician}</dt><dd>{labelFor(technician)}</dd></dl>}
        {admin && <div className="pd-villa-danger"><button type="button" className="pd-delete-link" disabled={busy || deleting} onClick={() => { setDeleteError(''); setDeleteOpen(true); }}><Trash2 size={15} />{c.deleteVilla}</button></div>}
      </section>}
      {activeTab === 'location' && <section id="villa-panel-location" role="tabpanel" aria-labelledby="villa-tab-location" className="pd-tab-panel pd-geofence">
        <div className="pd-geofence-heading"><MapPin size={17} /><div><h3>{c.geofence}</h3><p className="pd-muted pd-help">{c.geofenceHelp}</p></div></div>
        <VillaGeofenceMap
          latitude={latitude}
          longitude={longitude}
          radiusMeters={radiusMeters}
          editable={admin}
          disabled={busy}
          copy={c}
          onCoordinatesChange={(nextLatitude, nextLongitude) => { setLatitude(nextLatitude); setLongitude(nextLongitude); }}
          onRadiusChange={setRadiusMeters}
        />
        {admin ? <>
          <div className="pd-coordinate-grid">
            <label>{c.latitude}<input type="number" inputMode="decimal" step="any" min="-90" max="90" value={latitude} onChange={event => setLatitude(event.target.value)} disabled={busy} placeholder="22.890533" /></label>
            <label>{c.longitude}<input type="number" inputMode="decimal" step="any" min="-180" max="180" value={longitude} onChange={event => setLongitude(event.target.value)} disabled={busy} placeholder="-109.916737" /></label>
          </div>
          <div className="pd-geofence-actions">
            <button type="button" className="pd-button" disabled={busy || gettingLocation || !navigator.geolocation} onClick={useCurrentLocation}><LocateFixed size={16} />{gettingLocation ? c.locating : c.useCurrentLocation}</button>
            {(latitude || longitude) ? <button type="button" className="pd-text-button" disabled={busy} onClick={() => { setLatitude(''); setLongitude(''); }}>{c.clearLocation}</button> : null}
          </div>
        </> : latitude && longitude ? <dl className="pd-leads"><dt>{c.coordinates}</dt><dd>{latitude}, {longitude}</dd><dt>{c.geofenceRadius}</dt><dd>{radiusMeters} m</dd></dl> : null}
      </section>}
      {activeTab === 'participants' && <section id="villa-panel-participants" role="tabpanel" aria-labelledby="villa-tab-participants" className="pd-tab-panel pd-participants"><h3>{c.participants} <span>{participants.length}</span></h3>
        {participants.length ? participants.map(id => {
          const person = data.staff.find(p => p.id === id);
          const isFullAccessRole = person?.rol === 'admin' || person?.rol === 'supervisor_instalacion';
          return (
            <div className="pd-person" key={id}>
              <div className="pd-person-info">
                <strong>{labelFor(id)}</strong>
                <span>{getRoleLabel(person?.rol || '', t)}</span>
              </div>
              <div className="pd-person-actions">
                {isFullAccessRole ? (
                  <span className="pd-total-access-badge">{t('Acceso total')}</span>
                ) : admin ? (
                  <select
                    className="pd-access-select"
                    value={participantAccess[id] || 'mis_tareas'}
                    disabled={busy}
                    onChange={(e) => setParticipantAccess(prev => ({ ...prev, [id]: e.target.value as any }))}
                    aria-label={`${t('Nivel de acceso')} ${labelFor(id)}`}
                  >
                    <option value="mis_tareas">{t('Mis tareas')}</option>
                    <option value="todas_las_tareas">{t('Todas las tareas de la villa')}</option>
                  </select>
                ) : (
                  <span className="pd-access-badge">
                    {(participantAccess[id] || 'mis_tareas') === 'todas_las_tareas' ? t('Todas las tareas de la villa') : t('Mis tareas')}
                  </span>
                )}
                {admin && (
                  <button
                    type="button"
                    className="pd-remove-btn"
                    aria-label={`${c.remove}: ${labelFor(id)}`}
                    disabled={busy}
                    onClick={() => {
                      setParticipants(previous => previous.filter(member => member !== id));
                      setParticipantAccess(prev => { const n = { ...prev }; delete n[id]; return n; });
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        }) : <p className="pd-muted">{c.noParticipants}</p>}
        {admin && (
          <div className="pd-add-person">
            <div className="pd-add-row">
              <AppSelect aria-label={c.addParticipant} value={personId} disabled={busy} onChange={event => setPersonId(event.target.value)}>
                <option value="">{c.addParticipant}</option>
                {available.map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}
              </AppSelect>
              <button
                type="button"
                className="pd-primary"
                disabled={busy || !personId || !available.some(p => p.id === personId)}
                onClick={() => {
                  setParticipants(previous => [...previous, personId]);
                  setParticipantAccess(prev => ({ ...prev, [personId]: 'mis_tareas' }));
                  setPersonId('');
                }}
              >
                <Plus size={16} aria-hidden="true" />
                <span>{c.add}</span>
              </button>
            </div>
          </div>
        )}
        <p className="pd-muted pd-help">{c.inheritedHelp}</p>
      </section>}
      {error && <p role="alert" className="pd-error">{error}<button type="button" className="pd-text-button" disabled={busy} onClick={() => { if (window.confirm(c.unsaved)) { onDirty(false); void saved(); } }}>{c.reload}</button></p>}
      <p role="status" className="pd-notice">{notice}</p>
      {admin && <footer><button type="submit" className="pd-primary" disabled={!dirty || busy || !villaName.trim()}>{busy ? c.saving : c.save}</button></footer>}
    </form>
    {deleteOpen && <DeleteVillaDialog villa={villa} c={c} busy={deleting} error={deleteError} close={() => { if (!deleting) setDeleteOpen(false); }} confirm={() => void removeVilla()} />}
  </aside>;
}

export function ProjectDirectoryView() {
  const { adminProfile } = useAdminAuth(); const admin = adminProfile?.rol === 'admin' && adminProfile.activo === true;
  const { language } = useTranslation(); const c = PROJECT_COPY[language];
  const { directorySearchQuery, setDirectorySearchQuery } = useSidebar();
  const resources = useSectionResources();
  const cached = resources.queries.read<ProjectDirectory>(`directory:${admin}`);
  const [data, setData] = useState(cached || EMPTY); const [loading, setLoading] = useState(!cached); const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''); const [developmentId, setDevelopmentId] = useState(''); const [villaId, setVillaId] = useState('');
  const [notice, setNotice] = useState(''); const [actionError, setActionError] = useState(''); const [editorVersion, setEditorVersion] = useState(0);
  const [deletingDevelopmentId, setDeletingDevelopmentId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Development | null>(null); const [deleteError, setDeleteError] = useState('');
  const [statusFilters, setStatusFilters] = useState<ProjectVilla['estatus'][]>([]);
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
  useEffect(() => { if (directorySearchQuery) setVillaId(''); }, [directorySearchQuery]);
  useEffect(() => () => setDirectorySearchQuery(''), [setDirectorySearchQuery]);
  const development = data.developments.find(d => d.id === developmentId);
  const selectedVilla = data.villas.find(v => v.id === villaId && v.desarrollo_id === development?.id && (!statusFilters.length || statusFilters.includes(v.estatus)));
  const visibleByStatus = useMemo(() => statusFilters.length ? data.villas.filter(v => statusFilters.includes(v.estatus)) : data.villas, [data.villas, statusFilters]);
  const staffNames = useMemo(() => new Map(data.staff.map(person => [person.id, person.nombre])), [data.staff]);
  const normalizedDirectoryQuery = normalize(directorySearchQuery);
  const matchingVillas = useMemo(() => visibleByStatus.filter(villa => !normalizedDirectoryQuery || normalize(`${villa.villa} ${villa.numero_proyecto || ''} ${villa.cliente || ''}`).includes(normalizedDirectoryQuery)), [visibleByStatus, normalizedDirectoryQuery]);
  const matchingDevelopmentIds = useMemo(() => new Set(matchingVillas.map(villa => villa.desarrollo_id)), [matchingVillas]);
  const developments = useMemo(() => data.developments.filter(item => !normalizedDirectoryQuery || matchingDevelopmentIds.has(item.id)), [data.developments, normalizedDirectoryQuery, matchingDevelopmentIds]);
  useEffect(() => {
    if (!normalizedDirectoryQuery || dirty.current) return;
    if (developments.length > 0 && (!developmentId || !matchingDevelopmentIds.has(developmentId))) {
      setDevelopmentId(developments[0].id);
      setVillaId('');
    }
  }, [normalizedDirectoryQuery, matchingDevelopmentIds, developmentId, developments]);
  const villas = matchingVillas.filter(v => v.desarrollo_id === development?.id).sort((a, b) => a.villa.localeCompare(b.villa, language, { numeric: true }));
  const counts = useMemo(() => { const map = new Map<string, number>(); for (const villa of matchingVillas) map.set(villa.desarrollo_id, (map.get(villa.desarrollo_id) || 0) + 1); return map; }, [matchingVillas]);
  const toggleStatusFilter = (status: ProjectVilla['estatus']) => setStatusFilters(current => current.includes(status)
    ? current.length === 1 ? current : current.filter(item => item !== status)
    : PROJECT_STATUSES.filter(item => current.includes(item) || item === status));
  const changed = async () => { resources.queries.invalidate('tasks'); await load(); };
  const created = async (development: string, villa?: string) => { resources.queries.invalidate('tasks'); setDevelopmentId(development); setVillaId(villa || ''); setDirectorySearchQuery(''); await load(); };
  const requestDevelopmentDeletion = () => {
    if (!development || deletingDevelopmentId) return;
    setActionError(''); setNotice('');
    const villaCount = data.villas.filter(villa => villa.desarrollo_id === development.id).length;
    if (villaCount > 0) {
      setActionError(villaCount === 1 ? c.developmentNotEmptySingle : c.developmentNotEmpty.replace('{count}', String(villaCount)));
      return;
    }
    setDeleteError(''); setDeleteTarget(development);
  };
  const removeDevelopment = async () => {
    if (!deleteTarget || deletingDevelopmentId) return;
    setDeletingDevelopmentId(deleteTarget.id); setDeleteError('');
    try {
      await deleteDevelopment(deleteTarget.id);
      resources.queries.invalidate('tasks');
      setDevelopmentId(''); setVillaId(''); setDirectorySearchQuery('');
      setDeleteTarget(null); setNotice(c.developmentDeleted);
      await load();
    } catch (error) { setDeleteError(projectError(error, c)); }
    finally { setDeletingDevelopmentId(''); }
  };
  if (loading) return <div className="operational-panel pd-loading" role="status"><Loader2 size={24} className="animate-spin" />{c.loading}</div>;
  return <section className={`project-directory operational-panel ${development ? 'pd-has-development' : ''} ${selectedVilla ? 'pd-has-villa' : ''}`} aria-label={c.projects}>
    {error && <div className="pd-error pd-load-error" role="alert">{error}<button className="pd-button" disabled={refreshing} onClick={() => void load()}>{c.retry}</button></div>}
    {actionError && <div className="pd-error pd-action-error" role="alert">{actionError}<button type="button" className="pd-icon" aria-label={c.close} onClick={() => setActionError('')}><X size={16} /></button></div>}
    {notice && <p className="pd-saved-notice" role="status">{notice}</p>}
    <div className="pd-layout">
      <aside className="pd-developments" aria-label={c.developments}>
        <header><h2>{c.developments}</h2><button type="button" className="pd-icon" aria-label={c.reload} disabled={refreshing} onClick={() => { if (canLeave()) void load(); }}><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button></header>
        {admin && <div className="pd-development-actions"><button className="pd-primary" type="button" onClick={() => { if (canLeave()) setCreation('development'); }}><Plus size={16} />{c.newDevelopment}</button></div>}
        <div className="pd-development-list">{developments.map(d => <button key={d.id} type="button" aria-pressed={d.id === developmentId} className="pd-development" onClick={() => { if (canLeave()) { setDevelopmentId(d.id); setVillaId(''); setActionError(''); } }}><Building2 size={17} /><span>{d.nombre}</span><span className="pd-count">{counts.get(d.id) || 0}</span><ChevronRight size={15} /></button>)}{!developments.length && <p className="pd-empty">{data.developments.length ? c.emptySearch : c.emptyDevelopments}</p>}</div>
      </aside>
      <div className="pd-villas">
        {development ? <><header><div><button type="button" className="pd-mobile-back" onClick={() => { if (canLeave()) { setDevelopmentId(''); setVillaId(''); } }}><ArrowLeft size={16} />{c.developments}</button><h2>{development.nombre}</h2><p className="pd-muted">{c.activeVillas} · {counts.get(development.id) || 0}</p></div>{admin && <div className="pd-header-actions"><button type="button" className="pd-icon" aria-label={c.developmentAccess} title={c.developmentAccess} disabled={Boolean(deletingDevelopmentId)} onClick={() => setAccess('development')}><Settings2 size={18} /></button><button type="button" className="pd-icon pd-danger-icon" aria-label={deletingDevelopmentId === development.id ? c.deletingDevelopment : c.deleteDevelopment} title={c.deleteDevelopment} disabled={Boolean(deletingDevelopmentId)} onClick={requestDevelopmentDeletion}>{deletingDevelopmentId === development.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}</button></div>}</header>
          <div className="pd-villa-tools"><details className="pd-status-filter"><summary aria-label={c.filterStatus}><ListFilter size={16} /><span>{statusFilters.length === 0 ? c.allStatuses : statusFilters.length === 1 ? projectStatusLabel(c, statusFilters[0]) : `${statusFilters.length} ${c.statuses}`}</span><ChevronDown size={15} /></summary><div className="pd-status-menu" role="group" aria-label={c.filterStatus}>{PROJECT_STATUSES.map(status => { const checked = statusFilters.includes(status); return <label key={status} className={checked ? 'is-checked' : ''}><input type="checkbox" checked={checked} onChange={() => toggleStatusFilter(status)} /><span className="pd-check" aria-hidden="true">{checked ? <Check size={13} /> : null}</span><span>{projectStatusLabel(c, status)}</span></label>; })}<button type="button" className="pd-status-clear" disabled={!statusFilters.length} onClick={() => setStatusFilters([])}>{c.clearFilter}</button></div></details>{admin && <button className="pd-primary" type="button" onClick={() => { if (canLeave()) setCreation('villa'); }}><Plus size={16} />{c.newVilla}</button>}</div>
          <div className="pd-villa-list">
            {villas.length > 0 && <div className="pd-villa-list-head" aria-hidden="true"><span>{c.villaName}</span><span>{c.integrator}</span><span>{c.technician}</span><span>{c.projectStatus}</span></div>}
            <div className="pd-villa-list-body">
              {villas.map(villa => <button className={`pd-villa ${villa.id === villaId ? 'is-selected' : ''}`} type="button" key={villa.id} aria-pressed={villa.id === villaId} onClick={() => { if (canLeave()) { setVillaId(villa.id); setDirectorySearchQuery(''); } }}>
                <span className="pd-villa-identity"><strong>{villa.villa}</strong><span className="pd-villa-meta">{villa.numero_proyecto && <span>{villa.numero_proyecto}</span>}{villa.cliente && <span>{villa.cliente}</span>}{!villa.numero_proyecto && !villa.cliente && villa.descripcion && <span>{villa.descripcion}</span>}</span></span>
                <span className="pd-villa-assignee"><small>{c.integrator}</small><span>{staffNames.get(villa.integrador_id || '') || c.unassigned}</span></span>
                <span className="pd-villa-assignee"><small>{c.technician}</small><span>{staffNames.get(villa.tecnico_id || '') || c.unassigned}</span></span>
                <span className="pd-villa-row-end"><span className={`pd-status-badge is-${villa.estatus}`}>{projectStatusLabel(c, villa.estatus)}</span><ChevronRight size={17} /></span>
              </button>)}
              {!villas.length && <div className="pd-empty"><p>{directorySearchQuery ? c.emptySearch : c.emptyVillas}</p><p className="pd-muted pd-help">{c.viewInactive}</p></div>}
            </div>
          </div>
        </> : <div className="pd-empty pd-select-empty"><Building2 size={28} /><p>{c.chooseDevelopment}</p></div>}
      </div>
      {selectedVilla && <VillaTeam key={`${selectedVilla.id}:${selectedVilla.equipo_revision}:${editorVersion}`} villa={selectedVilla} data={data} admin={admin} c={c} close={() => { if (canLeave()) setVillaId(''); }} saved={async () => { await changed(); setNotice(c.saved); }} deleted={async () => { setVillaId(''); await changed(); setNotice(c.villaDeleted); }} onDirty={setDirty} />}
    </div>
    {creation && admin && <CreateLocation c={c} development={creation === 'villa' ? development : undefined} close={() => setCreation(null)} created={created} />}
    {access && admin && <AccessSettings c={c} development={access === 'development' ? development : undefined} data={data} close={() => setAccess(null)} changed={changed} />}
    {deleteTarget && admin && <DeleteDevelopmentDialog development={deleteTarget} c={c} busy={deletingDevelopmentId === deleteTarget.id} error={deleteError} close={() => { if (!deletingDevelopmentId) { setDeleteTarget(null); setDeleteError(''); } }} confirm={() => void removeDevelopment()} />}
  </section>;
}
