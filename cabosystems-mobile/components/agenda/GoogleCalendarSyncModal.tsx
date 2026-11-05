import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { CalendarSync, Check, X, ExternalLink, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { AgendaPalette as P, Colors } from '@/constants/Theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { resolveCalendarDisplayName } from '@/lib/companyAgendaPresentation';
import type { CompanyAgendaCopy } from '@/lib/companyAgendaCopy';

interface GoogleCalendarSyncModalProps {
  visible: boolean;
  onClose: () => void;
  onSyncDone: () => void;
  copy: CompanyAgendaCopy;
  locale: string;
}

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  revision: string;
  account: string | null;
  selectedCalendars?: CalendarInfo[];
}

interface CalendarInfo {
  id: string;
  name: string;
  accessRole: string;
}

export const GoogleCalendarSyncModal: React.FC<GoogleCalendarSyncModalProps> = ({
  visible,
  onClose,
  onSyncDone,
  copy: c,
  locale,
}) => {
  const { profile, user } = useAuth();
  const isEs = locale.startsWith('es');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'status' },
      });
      if (error) {
        let msg = '';
        try {
          const resp = error.context instanceof Response ? await error.context.clone().json() : null;
          msg = resp?.error || '';
        } catch {}
        setErrorMessage(msg || (isEs ? 'No se pudo verificar el estado de Google Calendar.' : 'Could not check Google Calendar status.'));
        setStatus(null);
      } else if (data) {
        const next = data as CalendarStatus;
        setStatus(next);
        setSelected((next.selectedCalendars || []).map((calendar) => calendar.id));
        setCalendars(null);
      }
    } catch (err) {
      setErrorMessage(isEs ? 'Error al consultar Google Calendar.' : 'Error checking Google Calendar.');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendars = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', { body: { action: 'calendars' } });
      if (error || !data?.calendars) throw new Error();
      setCalendars(data.calendars as CalendarInfo[]);
      setStatus((current) => current ? { ...current, revision: data.revision } : current);
    } catch {
      setErrorMessage(isEs ? 'No se pudieron consultar tus calendarios.' : 'Could not load your calendars.');
    } finally {
      setLoading(false);
    }
  };

  const saveCalendars = async () => {
    if (!status?.revision) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.functions.invoke('google-calendar', { body: { action: 'select', revision: status.revision, calendarIds: selected } });
      if (error) throw new Error();
      await fetchStatus();
      onSyncDone();
    } catch {
      setErrorMessage(isEs ? 'No se pudo guardar tu selección de calendarios.' : 'Could not save your calendar selection.');
      setLoading(false);
    }
  };

  const toggleCalendar = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  useEffect(() => {
    if (visible) {
      fetchStatus();
    }
  }, [visible]);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'connect', replace: true },
      });
      if (error) {
        let msg = '';
        try {
          const resp = error.context instanceof Response ? await error.context.clone().json() : null;
          msg = resp?.error || '';
        } catch {}
        setErrorMessage(msg || (isEs ? 'No se pudo generar el enlace de conexión.' : 'Could not generate authorization link.'));
        setConnecting(false);
        return;
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (err) {
      setErrorMessage(isEs ? 'Error abriendo autorización de Google.' : 'Error opening Google authorization.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.titleRow}>
              <View style={s.iconWrap}>
                <CalendarSync size={20} color={Colors.primary} />
              </View>
              <Text style={s.title}>{c.syncCalendar}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn}>
              <X size={20} color={P.slate} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content}>
            {loading ? (
              <View style={s.centerBox}>
                <ActivityIndicator color={Colors.primary} size="large" />
                <Text style={s.subtext}>{isEs ? 'Comprobando sincronización...' : 'Checking sync status...'}</Text>
              </View>
            ) : (
              <>
                {/* Status Box */}
                {status?.connected ? (
                  <View style={s.statusSuccess}>
                    <ShieldCheck size={20} color="#16a34a" />
                    <View style={s.statusTextWrap}>
                      <Text style={s.statusTitle}>{isEs ? 'Cuenta conectada' : 'Account connected'}</Text>
                      <Text style={s.accountLabel}>{status.account || (isEs ? 'Cuenta Google' : 'Google account')}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={s.statusWarning}>
                    <AlertTriangle size={20} color="#d97706" />
                    <View style={s.statusTextWrap}>
                      <Text style={s.statusWarningTitle}>
                        {isEs ? 'Sin cuenta Google sincronizada' : 'No Google account synced'}
                      </Text>
                      <Text style={s.statusWarningDesc}>
                        {isEs
                          ? 'Se está utilizando tu calendario local de CaboSystems. Si conectas Google, tus eventos se sincronizan en ambos sentidos.'
                          : 'You are using your local CaboSystems calendar. If you connect Google, events sync both ways.'}
                      </Text>
                    </View>
                  </View>
                )}

                {errorMessage ? (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* Explanation text */}
                <Text style={s.helpText}>
                  {isEs
                    ? 'Cada usuario puede vincular su cuenta de Google Calendar. Si no la vinculas, el sistema gestiona tu agenda mediante el calendario local de CaboSystems.'
                    : 'Each user can connect their own Google Calendar account. If not connected, the local CaboSystems calendar is used.'}
                </Text>

                {status?.connected ? (
                  <>
                    <Pressable onPress={loadCalendars} style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}>
                      <CalendarSync size={16} color={P.ink} />
                      <Text style={s.secondaryBtnText}>{isEs ? 'Elegir mis calendarios' : 'Choose my calendars'}</Text>
                    </Pressable>
                    {calendars ? (
                      <View style={s.calendarList}>
                        {calendars.map((calendar) => {
                          const readable = ['owner', 'writer', 'reader', 'writerWithoutPrivateAccess', 'freeBusyReader'].includes(calendar.accessRole);
                          const checked = selected.includes(calendar.id);
                          return (
                            <Pressable key={calendar.id} disabled={!readable} onPress={() => toggleCalendar(calendar.id)} style={({ pressed }) => [s.calendarRow, pressed && s.pressed, !readable && s.disabledBtn]}>
                              <View style={[s.checkbox, checked && s.checkboxChecked]}>{checked ? <Check size={14} color={P.white} /> : null}</View>
                              <Text style={s.calendarName}>{resolveCalendarDisplayName(calendar, user?.email, profile?.nombre)}</Text>
                            </Pressable>
                          );
                        })}
                        <Pressable onPress={saveCalendars} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
                          <Check size={18} color={P.white} />
                          <Text style={s.primaryBtnText}>{isEs ? 'Guardar mis calendarios' : 'Save my calendars'}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {/* Action button: Connect / Reconnect */}
                <Pressable
                  disabled={connecting}
                  onPress={handleConnect}
                  style={({ pressed }) => [s.primaryBtn, pressed && s.pressed, connecting && s.disabledBtn]}
                >
                  {connecting ? (
                    <ActivityIndicator color={P.white} size="small" />
                  ) : (
                    <>
                      <ExternalLink size={18} color={P.white} />
                      <Text style={s.primaryBtnText}>
                        {status?.connected
                          ? (isEs ? 'Reconectar o cambiar cuenta' : 'Reconnect or change account')
                          : (isEs ? 'Conectar Google Calendar' : 'Connect Google Calendar')}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Refresh after browser auth */}
                <Pressable
                  onPress={() => {
                    fetchStatus();
                    onSyncDone();
                  }}
                  style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}
                >
                  <RefreshCw size={16} color={P.ink} />
                  <Text style={s.secondaryBtnText}>{isEs ? 'Actualizar y sincronizar ahora' : 'Refresh and sync now'}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: P.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: P.ink,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  centerBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 12,
  },
  subtext: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: P.slate,
  },
  statusSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
  },
  statusWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#15803d',
  },
  accountLabel: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
  },
  statusWarningTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#b45309',
  },
  statusWarningDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: '#92400e',
    lineHeight: 16,
    marginTop: 3,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 17,
  },
  helpText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: P.slate,
    lineHeight: 18,
  },
  calendarList: {
    gap: 8,
  },
  calendarRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: P.muted,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  calendarName: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: P.ink,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: P.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: P.wash,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: P.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
