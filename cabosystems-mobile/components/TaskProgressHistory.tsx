import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { getTaskProgressHistory, type TaskProgressActivity } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { getLocale } from '@/lib/localization';

function activityLabel(row: TaskProgressActivity, tr: (value: string, params?: Record<string, string | number>) => string) {
  if (row.accion === 'subtarea') return row.siguiente === 'true' ? tr('Completó la subtarea {value0}', { value0: row.subtarea_titulo || '' }) : tr('Reabrió la subtarea {value0}', { value0: row.subtarea_titulo || '' });
  const status = row.siguiente === 'en_proceso' ? tr('En Proceso') : row.siguiente === 'completada' ? tr('Completada') : tr('Pendiente');
  return tr('Cambió el estado a {value0}', { value0: status });
}

export function TaskProgressHistory({ taskId, version }: { taskId: string; version: string }) {
  const { t: tr } = useTranslation();
  const [rows, setRows] = useState<TaskProgressActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(false);
    void getTaskProgressHistory(taskId).then(value => { if (active) setRows(value); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, version, retry]);
  return <View style={styles.section}><Text style={styles.heading}>{tr('Historial de avances')}</Text>{loading ? <ActivityIndicator color="#f78c26" style={styles.loader} /> : error ? <View style={styles.retryRow}><Text style={styles.empty}>{tr('No se pudo cargar el historial.')}</Text><Pressable style={styles.retry} onPress={() => setRetry(value => value + 1)} accessibilityRole="button"><Text style={styles.retryText}>{tr('Reintentar')}</Text></Pressable></View> : rows.length === 0 ? <Text style={styles.empty}>{tr('Aún no hay avances registrados.')}</Text> : <View style={styles.list}>{rows.map(row => <View key={row.id} style={styles.item}><View style={styles.meta}><Text style={styles.actor}>{row.actor_name}</Text><Text style={styles.date}>{new Intl.DateTimeFormat(getLocale(), { dateStyle:'medium', timeStyle:'short', timeZone:'America/Mazatlan' }).format(new Date(row.captured_at))}</Text></View><Text style={styles.action}>{activityLabel(row,tr)}</Text>{row.comentario ? <Text style={styles.comment}>{row.comentario}</Text> : null}{row.evidence_url ? <Pressable style={styles.evidence} onPress={() => void Linking.openURL(row.evidence_url!)} accessibilityRole="button" accessibilityLabel={tr('Abrir evidencia')}><Image source={{ uri: row.evidence_url }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={150} /><View style={styles.evidenceLabel}><Camera size={14} color="#f78c26" /><Text style={styles.evidenceText}>{tr('Abrir evidencia')}</Text></View></Pressable> : null}</View>)}</View>}</View>;
}

const styles=StyleSheet.create({section:{marginTop:16},heading:{fontFamily:'Outfit_700Bold',fontSize:15,color:'#000000',marginBottom:10},loader:{marginVertical:16},empty:{fontFamily:'Outfit_400Regular',fontSize:13,color:'rgba(0,0,0,0.55)',paddingVertical:10},retryRow:{alignItems:'flex-start'},retry:{minHeight:44,justifyContent:'center',paddingHorizontal:14,borderWidth:1,borderColor:'#343e48',borderRadius:10},retryText:{fontFamily:'Outfit_600SemiBold',fontSize:13,color:'#343e48'},list:{gap:9},item:{borderWidth:1,borderColor:'rgba(0,0,0,0.10)',borderRadius:12,padding:11,backgroundColor:'#FFFFFF'},meta:{flexDirection:'row',justifyContent:'space-between',gap:12},actor:{flex:1,fontFamily:'Outfit_600SemiBold',fontSize:12,color:'#343e48'},date:{fontFamily:'Outfit_400Regular',fontSize:10,color:'rgba(0,0,0,0.55)'},action:{fontFamily:'Outfit_500Medium',fontSize:13,color:'#343e48',marginTop:4},comment:{fontFamily:'Outfit_400Regular',fontSize:13,lineHeight:18,color:'#343e48',borderLeftWidth:1,borderLeftColor:'#f78c26',paddingLeft:8,marginTop:8},evidence:{marginTop:9,alignSelf:'flex-start'},image:{width:132,height:84,borderRadius:8},evidenceLabel:{flexDirection:'row',alignItems:'center',gap:5,marginTop:5},evidenceText:{fontFamily:'Outfit_600SemiBold',fontSize:11,color:'#f78c26'}});
