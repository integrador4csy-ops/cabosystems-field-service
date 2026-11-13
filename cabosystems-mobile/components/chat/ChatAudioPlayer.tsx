import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Play, Pause } from 'lucide-react-native';
import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import { ChatPalette as P } from '@/constants/Theme';

/**
 * Una sola nota de voz puede sonar a la vez. expo-audio pide el foco de audio al
 * reproducir: si dos notas quedan vivas, la segunda se queda sin foco y no suena
 * (el foco se abandona al liberar el player anterior).
 */
let activePlayerId: string | null = null;
const activePlayers = new Map<string, { pause: () => void }>();

export function audioTime(seconds = 0) { const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

/** Espera acotada: el promise de seekTo puede no resolverse nunca en Android. */
function settle<T>(work: Promise<T>, ms: number) {
  return Promise.race([work.catch(() => undefined), new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms))]);
}

export function ChatAudioPlayer({ uri, duration = 0, outgoing = false, label, onError }: { uri: string; duration?: number; outgoing?: boolean; label: string; onError: () => void }) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const { t: tr } = useInterfaceTranslation();
  const color = outgoing ? P.white : P.ink;
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  // Al desmontar se detiene la nota y se suelta el foco: si no, el player queda
  // vivo ocupando el foco de audio y las siguientes notas no reproducen.
  useEffect(() => {
    activePlayers.set(player.id, { pause: () => { try { player.pause(); } catch { /* Liberado por el hook. */ } } });
    return () => {
      activePlayers.delete(player.id);
      if (activePlayerId === player.id) activePlayerId = null;
      try { player.pause(); } catch { /* Liberado por el hook. */ }
    };
  }, [player]);

  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setFailed(false);
      if (status.playing) {
        player.pause();
        if (activePlayerId === player.id) activePlayerId = null;
        return;
      }
      // Silencia cualquier otra nota de voz en curso.
      activePlayers.forEach((entry, id) => { if (id !== player.id) entry.pause(); });
      activePlayerId = player.id;

      // El grabador deja el modo de audio en "sin grabación"; se repone para que
      // la nota se oiga también con el teléfono en silencio.
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

      // Tras terminar, el player queda en estado "finalizado": hay que volver al
      // inicio. Antes se encadenaba con el promise de seekTo, que en Android puede
      // no resolverse, y entonces play() nunca llegaba a ejecutarse.
      const ended = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration);
      if (ended) await settle(player.seekTo(0), 600);

      await player.play();
    } catch (err) {
      console.warn('No se pudo reproducir la nota de voz:', err);
      setFailed(true);
      onError();
    } finally {
      busy.current = false;
    }
  }, [player, status, onError]);

  const error = status.error;
  const time = status.playing ? status.currentTime : (status.duration || duration);

  return <View style={s.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: status.playing }} style={s.play} onPress={() => { void toggle(); }}>
      {status.playing ? <Pause size={21} color={color} /> : <Play size={21} color={color} />}
    </Pressable>
    <View style={s.body}>
      <Text style={[s.label, { color }]}>{failed || error ? tr('No se pudo reproducir') : label}</Text>
      <View style={s.track}><View style={[s.progress, { backgroundColor: color, width: `${Math.min(100, status.duration ? status.currentTime / status.duration * 100 : 0)}%` }]} /></View>
    </View>
    <Text style={[s.time, { color }]}>{audioTime(time)}</Text>
  </View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 180, maxWidth: '100%' }, play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, gap: 8 }, label: { fontFamily: 'Outfit_400Regular', fontSize: 12 }, track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(52,62,72,0.20)', overflow: 'hidden' }, progress: { height: 3 }, time: { fontFamily: 'Outfit_400Regular', fontSize: 11 } });
