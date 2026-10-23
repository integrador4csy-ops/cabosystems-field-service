import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../ui/useDialog';
import { useTranslation } from '../../context/LanguageContext';
import { calendarRequest, type GoogleCalendar, type GoogleCalendarStatus } from '../../lib/googleCalendarApi';

const COPY = {
  es: {
    title: 'Google Calendar', close: 'Cerrar', refresh: 'Actualizar', loading: 'Cargando…',
    connect: 'Conectar cuenta Google', replace: 'Cambiar o volver a autorizar la cuenta',
    replaceConfirm: 'Confirmo que esta autorización reemplazará la cuenta actual y vaciará su selección de calendarios.',
    unconfigured: 'Falta configurar Google Calendar en el servidor. Contacta al administrador.',
    disconnected: 'Conecta primero una cuenta de pruebas. Después podrás elegir los calendarios de la empresa.',
    connected: 'Cuenta conectada:', choose: 'Calendarios disponibles', readOnly: 'Solo consulta', availabilityOnly: 'Solo disponibilidad · se muestra como Ocupado', needsDetails: 'Para mostrar sus eventos, comparte este calendario con la cuenta conectada y permite ver todos los detalles de los eventos.', unavailable: 'Sin permiso para consultar eventos', selected: 'Calendarios seleccionados:', noSelection: 'Todavía no seleccionaste calendarios.',
    save: 'Guardar selección', saved: 'Selección guardada.',
    failure: 'No se pudo completar la operación. Revisa la conexión e intenta de nuevo.',
    privacy: 'Selecciona únicamente calendarios destinados a la agenda de empresa. Los de solo consulta se pueden mostrar, pero no editar. No se seleccionan automáticamente los calendarios personales.',
    pending: 'Los eventos de los calendarios seleccionados aparecen en la agenda al actualizar. Al crear un evento, elige su calendario. Los cambios se guardan directamente en Google. Horario de Los Cabos.',
    popup: 'Permite abrir la ventana de Google para autorizar la cuenta.',
    authorize: 'Completa la autorización en la pestaña de Google y pulsa Actualizar aquí al terminar.',
    none: 'No hay calendarios disponibles para esta cuenta.', chooseFirst: 'Consultar calendarios',
  },
  en: {
    title: 'Google Calendar', close: 'Close', refresh: 'Refresh', loading: 'Loading…',
    connect: 'Connect Google account', replace: 'Change or reauthorize account',
    replaceConfirm: 'I confirm this authorization will replace the current account and clear its calendar selection.',
    unconfigured: 'Google Calendar is not configured on the server. Contact the administrator.',
    disconnected: 'Connect a test account first. You can then choose the company calendars.',
    connected: 'Connected account:', choose: 'Available calendars', readOnly: 'Read only', availabilityOnly: 'Availability only · displayed as Busy', needsDetails: 'To display events, share this calendar with the connected account and allow access to all event details.', unavailable: 'No permission to read events', selected: 'Selected calendars:', noSelection: 'No calendars selected yet.',
    save: 'Save selection', saved: 'Selection saved.',
    failure: 'The operation could not be completed. Check your connection and try again.',
    privacy: 'Only select calendars intended for the company agenda. Read-only calendars can be displayed but not edited. Personal calendars are not selected automatically.',
    pending: 'Events from selected calendars appear when you refresh the agenda. Choose a calendar when creating an event. Changes are saved directly to Google. Times use Los Cabos time.',
    popup: 'Allow the Google window to open to authorize the account.',
    authorize: 'Complete authorization in the Google tab, then press Refresh here.',
    none: 'No calendars are available for this account.', chooseFirst: 'Load calendars',
  },
};

export function GoogleCalendarDialog({ onClose }: { onClose: () => void }) {
  const { locale } = useTranslation();
  const c = COPY[locale.startsWith('en') ? 'en' : 'es'];
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const lock = useRef(false);
  const dialog = useDialog(true, () => { if (!lock.current) onClose(); });

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const request = generation.current;
    try { await action(); }
    catch (reason) { if (generation.current === request) setError(reason instanceof Error && reason.message ? reason.message : c.failure); }
    finally { lock.current = false; if (generation.current === request) setBusy(false); }
  }
  async function load() {
    const request = generation.current;
    const next = await calendarRequest<GoogleCalendarStatus>({ action: 'status' });
    if (generation.current !== request) return;
    setStatus(next); setRevision(next.revision); setSelected(next.selectedCalendars.map((item) => item.id)); setCalendars(null); setReplace(false);
  }
  useEffect(() => {
    const request = ++generation.current;
    queueMicrotask(() => { if (generation.current === request) void run(load); });
    return () => { generation.current += 1; };
    // Only initialize this mounted, account-keyed dialog. Refresh is explicit so
    // switching to Google cannot discard a user's unsaved calendar selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    const child = window.open('about:blank', '_blank');
    if (!child) { setError(c.popup); return; }
    child.opener = null;
    await run(async () => {
      try {
        const { url } = await calendarRequest<{ url: string }>({ action: 'connect', replace });
        const target = new URL(url);
        if (target.origin !== 'https://accounts.google.com' || target.pathname !== '/o/oauth2/v2/auth') throw new Error(c.failure);
        child.location.replace(target.href);
        setNotice(c.authorize);
      } catch (reason) { child.close(); throw reason; }
    });
  }
  async function list() {
    const next = await calendarRequest<{ revision: string; calendars: GoogleCalendar[] }>({ action: 'calendars' });
    if (status && next.revision !== status.revision) { await load(); throw new Error(c.failure); }
    setRevision(next.revision); setCalendars(next.calendars);
  }
  async function save() {
    await calendarRequest({ action: 'select', revision, calendarIds: selected });
    await load(); setNotice(c.saved);
  }
  return <div className="company-dialog-backdrop">
    <div ref={dialog} className="company-dialog google-calendar-dialog minimal-modal" role="dialog" aria-modal="true" aria-labelledby="google-calendar-title" tabIndex={-1}>
      <header><h2 id="google-calendar-title">{c.title}</h2><button type="button" className="workspace-icon" aria-label={c.close} disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <div className="google-calendar-body">
        {status ? <>
          {!status.configured && <p>{c.unconfigured}</p>}
          {status.connected ? <>
            <p>{c.connected} <strong>{status.account}</strong></p>
            <p>{status.selectedCalendars.length ? `${c.selected} ${status.selectedCalendars.map((calendar) => calendar.name).join(', ')}` : c.noSelection}</p>
            <p className="company-field-help">{c.privacy}</p>
            <button type="button" className="workspace-button" disabled={busy || !status.configured} onClick={() => void run(list)}>{c.chooseFirst}</button>
            {calendars && <fieldset disabled={busy}><legend>{c.choose}</legend>
              {calendars.length === 0 && <p>{c.none}</p>}
              {calendars.map((calendar) => {
                const writable = ['owner', 'writer'].includes(calendar.accessRole);
                const readable = ['owner', 'writer', 'reader', 'writerWithoutPrivateAccess', 'freeBusyReader'].includes(calendar.accessRole);
                return <label className="google-calendar-option" key={calendar.id}><input type="checkbox" disabled={!readable || busy} checked={selected.includes(calendar.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, calendar.id] : current.filter((id) => id !== calendar.id))} /><span>{calendar.name}{!writable && <span className="company-event-meta">{calendar.accessRole === 'freeBusyReader' ? c.availabilityOnly : readable ? c.readOnly : c.unavailable}</span>}{!readable && <span className="company-event-meta">{c.needsDetails}</span>}</span></label>;
              })}
              <button type="button" className="workspace-primary" disabled={busy} onClick={() => void run(save)}>{c.save}</button>
            </fieldset>}
            <label className="google-calendar-option"><input type="checkbox" disabled={busy} checked={replace} onChange={(event) => setReplace(event.target.checked)} /><span>{c.replaceConfirm}</span></label>
          </> : <p>{c.disconnected}</p>}
          <button type="button" className="workspace-button" disabled={busy || !status.configured || (status.connected && !replace)} onClick={() => void connect()}>{status.connected ? c.replace : c.connect}</button>
          <p className="company-field-help">{c.pending}</p>
        </> : busy ? <p role="status">{c.loading}</p> : null}
        {error && <p role="alert" className="company-error">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <footer><button type="button" className="workspace-button" disabled={busy} onClick={() => void run(load)}>{busy ? c.loading : c.refresh}</button><span /><button type="button" className="workspace-button" disabled={busy} onClick={onClose}>{c.close}</button></footer>
      </div>
    </div>
  </div>;
}
