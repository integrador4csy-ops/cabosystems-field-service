import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../ui/useDialog';
import { useTranslation } from '../../context/LanguageContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { resolveCalendarDisplayName } from '../../lib/agendaPresentation';
import { calendarRequest, type GoogleCalendar, type GoogleCalendarStatus } from '../../lib/googleCalendarApi';

const COPY = {
  es: {
    title: 'Google Calendar', close: 'Cerrar', refresh: 'Actualizar', loading: 'Cargando…',
    connect: 'Conectar mi cuenta Google', replace: 'Cambiar o volver a autorizar mi cuenta',
    replaceConfirm: 'Confirmo que esta autorización reemplazará mi cuenta conectada y vaciará mi selección de calendarios.',
    unconfigured: 'Falta configurar Google Calendar en el servidor. Contacta al administrador.',
    disconnected: 'Conecta tu cuenta de Google. Después podrás elegir cuáles de tus calendarios deseas mostrar.',
    connected: 'Tu cuenta conectada:', choose: 'Tus calendarios disponibles', readOnly: 'Solo consulta', availabilityOnly: 'Solo disponibilidad · se muestra como Ocupado', needsDetails: 'Google no permite consultar los detalles de este calendario.', unavailable: 'Sin permiso para consultar eventos', selected: 'Tus calendarios seleccionados:', noSelection: 'Todavía no seleccionaste calendarios.',
    save: 'Guardar selección', saved: 'Selección guardada.',
    failure: 'No se pudo completar la operación. Revisa la conexión e intenta de nuevo.',
    privacy: 'Esta conexión es personal: los demás usuarios no pueden usar tu cuenta ni ver tus calendarios desde su sesión. Tú decides cuáles mostrar.',
    pending: 'Tus calendarios seleccionados aparecen solamente en tu agenda al actualizar. Los cambios compatibles se guardan directamente en tu Google Calendar. Horario de Los Cabos.',
    popup: 'Permite abrir la ventana de Google para autorizar la cuenta.',
    authorize: 'Completa la autorización en la pestaña de Google y pulsa Actualizar aquí al terminar.',
    none: 'No hay calendarios disponibles para esta cuenta.', chooseFirst: 'Consultar calendarios',
  },
  en: {
    title: 'Google Calendar', close: 'Close', refresh: 'Refresh', loading: 'Loading…',
    connect: 'Connect my Google account', replace: 'Change or reauthorize my account',
    replaceConfirm: 'I confirm this authorization will replace my connected account and clear my calendar selection.',
    unconfigured: 'Google Calendar is not configured on the server. Contact the administrator.',
    disconnected: 'Connect your Google account. You can then choose which of your calendars to display.',
    connected: 'Your connected account:', choose: 'Your available calendars', readOnly: 'Read only', availabilityOnly: 'Availability only · displayed as Busy', needsDetails: 'Google does not allow this calendar\'s event details to be read.', unavailable: 'No permission to read events', selected: 'Your selected calendars:', noSelection: 'No calendars selected yet.',
    save: 'Save selection', saved: 'Selection saved.',
    failure: 'The operation could not be completed. Check your connection and try again.',
    privacy: 'This connection is personal: other users cannot use your account or see your calendars from their sessions. You choose which ones to display.',
    pending: 'Your selected calendars appear only in your agenda after refreshing. Compatible changes are saved directly to your Google Calendar. Times use Los Cabos time.',
    popup: 'Allow the Google window to open to authorize the account.',
    authorize: 'Complete authorization in the Google tab, then press Refresh here.',
    none: 'No calendars are available for this account.', chooseFirst: 'Load calendars',
  },
};

export function GoogleCalendarDialog({ onClose }: { onClose: () => void }) {
  const { locale } = useTranslation();
  const { user, adminProfile } = useAdminAuth();
  const userEmail = user?.email || adminProfile?.email;
  const userFullName = adminProfile?.nombre || (user?.user_metadata?.nombre as string);
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
            <p>{status.selectedCalendars.length ? `${c.selected} ${status.selectedCalendars.map((calendar) => resolveCalendarDisplayName(calendar, userEmail, userFullName)).join(', ')}` : c.noSelection}</p>
            <p className="company-field-help">{c.privacy}</p>
            <button type="button" className="workspace-button" disabled={busy || !status.configured} onClick={() => void run(list)}>{c.chooseFirst}</button>
            {calendars && <fieldset disabled={busy}><legend>{c.choose}</legend>
              {calendars.length === 0 && <p>{c.none}</p>}
              {calendars.map((calendar) => {
                const writable = ['owner', 'writer'].includes(calendar.accessRole);
                const readable = ['owner', 'writer', 'reader', 'writerWithoutPrivateAccess', 'freeBusyReader'].includes(calendar.accessRole);
                const displayName = resolveCalendarDisplayName(calendar, userEmail, userFullName);
                return <label className="google-calendar-option" key={calendar.id}><input type="checkbox" disabled={!readable || busy} checked={selected.includes(calendar.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, calendar.id] : current.filter((id) => id !== calendar.id))} /><span>{displayName}{!writable && <span className="company-event-meta">{calendar.accessRole === 'freeBusyReader' ? c.availabilityOnly : readable ? c.readOnly : c.unavailable}</span>}{!readable && <span className="company-event-meta">{c.needsDetails}</span>}</span></label>;
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
