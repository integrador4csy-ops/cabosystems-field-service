import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPinned, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/Theme';
import { useTranslation } from '@/lib/i18n';
import type { FleetMapWorker } from '@/lib/fleetMap';

interface Props { workers: FleetMapWorker[]; loading: boolean; error: boolean; refreshing: boolean; onRefresh: () => void }

export function LiveFleetMap({ workers, loading, error, refreshing, onRefresh }: Props) {
  const { t } = useTranslation();
  return <View style={styles.container}>
    {loading ? <ActivityIndicator color={Colors.primary} /> : <MapPinned size={32} color={Colors.primary} />}
    <Text style={styles.title}>{error ? t('maps.unavailable') : t('maps.webTitle')}</Text>
    <Text style={styles.text}>{error ? t('maps.retryHelp') : t('maps.webHelp')}</Text>
    <Text style={styles.count}>{workers.length} {t('maps.people')}</Text>
    <Pressable disabled={refreshing} onPress={onRefresh} style={styles.button}><RefreshCw size={16} color="#FFFFFF" /><Text style={styles.buttonText}>{t('maps.refresh')}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28, backgroundColor: '#F2F4F7' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#101828', textAlign: 'center' },
  text: { maxWidth: 360, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, color: '#667085', textAlign: 'center' },
  count: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#475467' },
  button: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, paddingHorizontal: 16, borderRadius: 11, backgroundColor: Colors.primary },
  buttonText: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' },
});
