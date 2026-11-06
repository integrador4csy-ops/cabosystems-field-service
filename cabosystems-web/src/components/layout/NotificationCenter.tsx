import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, ClipboardCheck, ListChecks, MessageCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTranslation } from '../../context/LanguageContext';

type AppNotification = {
  id: string;
  kind: 'task_assigned' | 'field_check' | 'chat_message' | 'system';
  title: string;
  body: string;
  target: string | null;
  target_id: string | null;
  read_at: string | null;
  created_at: string;
};

const notificationClient = supabase as any;
let notificationChannelSequence = 0;

function relativeTime(value: string, english: boolean) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return english ? 'Now' : 'Ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return english ? `${minutes}m ago` : `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return english ? `${hours}h ago` : `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return english ? `${days}d ago` : `Hace ${days} d`;
}

export function NotificationCenter() {
  const { user } = useAdminAuth();
  const { setActiveItem, setTargetGroupId } = useSidebar();
  const { language, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await notificationClient.from('app_notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
    if (!error) setItems(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void load();
    const channel = notificationClient.channel(`web-notifications-${user.id}-${++notificationChannelSequence}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { void notificationClient.removeChannel(channel); };
  }, [user?.id, load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    await notificationClient.from('app_notifications').update({ read_at: readAt }).eq('user_id', user.id).is('read_at', null);
  };

  const openItem = (item: AppNotification) => {
    setOpen(false);
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
      void notificationClient.from('app_notifications').update({ read_at: readAt }).eq('id', item.id);
    }
    if (item.target === 'chat') {
      if (item.target_id) setTargetGroupId(item.target_id);
      setActiveItem('chat');
    } else if (item.target === 'tasks') {
      setActiveItem('proyectos');
    }
  };

  const english = language === 'en';
  return <div ref={rootRef} className="relative shrink-0">
    <button type="button" aria-label={t('Notificaciones')} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/25">
      <Bell size={19} aria-hidden="true" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-brand-500 px-0.5 text-[9px] font-bold leading-none text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-[120] flex max-h-[min(620px,calc(100vh-88px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" role="dialog" aria-label={t('Notificaciones')}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
        <div><h2 className="text-base font-semibold text-slate-900">{t('Notificaciones')}</h2><p className="mt-0.5 text-xs text-slate-500">{english ? 'Latest activity' : 'Actividad reciente'}</p></div>
        <div className="flex items-center gap-1">
          {unread > 0 && <button type="button" onClick={() => void markAllRead()} title={english ? 'Mark all as read' : 'Marcar todas como leídas'} aria-label={english ? 'Mark all as read' : 'Marcar todas como leídas'} className="flex h-9 w-9 items-center justify-center rounded-full text-brand-600 hover:bg-orange-50"><CheckCheck size={18} /></button>}
          <button type="button" onClick={() => setOpen(false)} aria-label={t('Cerrar')} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
      </div>
      <div className="overflow-y-auto p-2">
        {loading && items.length === 0 && <div className="py-12 text-center text-sm text-slate-500">{t('Cargando...')}</div>}
        {!loading && items.length === 0 && <div className="px-6 py-12 text-center"><Bell size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-800">{english ? 'You are up to date' : 'Estás al día'}</p><p className="mx-auto mt-1 max-w-64 text-sm leading-5 text-slate-500">{english ? 'New assignments, checks and messages will appear here.' : 'Aquí aparecerán nuevas asignaciones, checks y mensajes.'}</p></div>}
        {items.map((item) => {
          const Icon = item.kind === 'chat_message' ? MessageCircle : item.kind === 'field_check' ? ClipboardCheck : ListChecks;
          return <button type="button" key={item.id} onClick={() => openItem(item)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50 ${item.read_at ? '' : 'bg-orange-50/80'}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-brand-600"><Icon size={18} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{item.title}</span>{item.read_at ? <Check size={14} className="text-slate-400" /> : <span className="h-2 w-2 rounded-full bg-brand-500" />}</span><span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-600">{item.body}</span><span className="mt-1 block text-[11px] font-medium text-slate-400">{relativeTime(item.created_at, english)}</span></span>
          </button>;
        })}
      </div>
    </div>}
  </div>;
}
