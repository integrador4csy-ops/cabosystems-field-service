import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Play, Pause } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';

export function audioTime(seconds = 0) { const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

export function ChatAudioPlayer({ uri, duration = 0, outgoing = false, label, onError }: { uri: string; duration?: number; outgoing?: boolean; label: string; onError: () => void }) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const color = outgoing ? P.white : P.ink;
  return <View style={s.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: status.playing }} style={s.play} onPress={() => {
      try { if (status.playing) player.pause(); else { if (status.didJustFinish || status.currentTime >= status.duration && status.duration > 0) void player.seekTo(0).then(() => player.play()).catch(onError); else player.play(); } } catch { onError(); }
    }}>{status.playing ? <Pause size={21} color={color} /> : <Play size={21} color={color} />}</Pressable>
    <View style={s.body}><Text style={[s.label, { color }]}>{label}</Text><View style={s.track}><View style={[s.progress, { backgroundColor: color, width: `${Math.min(100, status.duration ? status.currentTime / status.duration * 100 : 0)}%` }]} /></View></View>
    <Text style={[s.time, { color }]}>{audioTime(status.playing ? status.currentTime : status.duration || duration)}</Text>
  </View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 180, maxWidth: '100%' }, play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, gap: 8 }, label: { fontFamily: 'Outfit_400Regular', fontSize: 12 }, track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(52,62,72,0.20)', overflow: 'hidden' }, progress: { height: 3 }, time: { fontFamily: 'Outfit_400Regular', fontSize: 11 } });
