import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react-native';
import { useTranslation } from '@/lib/i18n';
import { captureImageSafe, pickImageSafe } from '@/lib/mediaPicker';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TaskProgressModalProps {
  visible: boolean;
  title: string;
  actionLabel: string;
  onClose: () => void;
  onConfirm: (comment: string, photoUri: string | null) => Promise<void>;
}

export function TaskProgressModal({ visible, title, actionLabel, onClose, onConfirm }: TaskProgressModalProps) {
  const { t: tr } = useTranslation();
  const [comment, setComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const chooseCamera = async () => {
    const uri = await captureImageSafe({ quality: 0.8 });
    if (uri) { setPhotoUri(uri); setError(''); }
  };
  const chooseGallery = async () => {
    const uri = await pickImageSafe({ mediaTypes: 'images', quality: 0.8 });
    if (uri) { setPhotoUri(uri); setError(''); }
  };
  const submit = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try { await onConfirm(comment, photoUri); setComment(''); setPhotoUri(null); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : tr('No se pudo guardar el avance. Intenta de nuevo.')); }
    finally { setSaving(false); }
  };
  const close = () => { if (!saving) { setComment(''); setPhotoUri(null); setError(''); onClose(); } };

  return <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'} onRequestClose={close}>
    <SafeAreaView style={styles.screen} edges={['top','bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title} numberOfLines={2}>{title}</Text></View><Pressable style={styles.close} onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel={tr('Cerrar')}><X size={20} color="#343e48" /></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.action}>{actionLabel}</Text>
        <Text style={styles.label}>{tr('Comentario opcional')}</Text>
        <TextInput style={styles.input} value={comment} onChangeText={setComment} maxLength={2000} multiline textAlignVertical="top" placeholder={tr('Describe el trabajo realizado, una observación o el motivo del cambio.')} placeholderTextColor="rgba(0,0,0,0.45)" autoFocus />
        <Text style={styles.count}>{comment.length}/2000</Text>
        <Text style={styles.label}>{tr('Evidencia opcional')}</Text>
        {photoUri ? <View style={styles.preview}><Image source={{ uri: photoUri }} style={styles.image} contentFit="contain" transition={150} /><Pressable style={styles.remove} onPress={() => setPhotoUri(null)} disabled={saving}><Trash2 size={16} color="#343e48" /><Text style={styles.removeText}>{tr('Quitar foto')}</Text></Pressable></View> : <View style={styles.photoActions}><Pressable style={styles.photoButton} onPress={() => void chooseCamera()}><Camera size={18} color="#f78c26" /><Text style={styles.photoButtonText}>{tr('Tomar foto')}</Text></Pressable><Pressable style={styles.photoButton} onPress={() => void chooseGallery()}><ImagePlus size={18} color="#f78c26" /><Text style={styles.photoButtonText}>{tr('Elegir de galería')}</Text></Pressable></View>}
        <Text style={styles.help}>{tr('Una foto · JPEG, PNG o WebP · máximo 10 MB')}</Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable style={styles.cancel} onPress={close} disabled={saving}><Text style={styles.cancelText}>{tr('Cancelar')}</Text></Pressable><Pressable style={styles.submit} onPress={() => void submit()} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{tr('Confirmar avance')}</Text>}</Pressable></View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#FFFFFF'}, header:{minHeight:72,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'rgba(0,0,0,0.10)'},headerCopy:{flex:1},title:{fontFamily:'Outfit_700Bold',fontSize:19,lineHeight:24,color:'#000000'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},content:{padding:16,paddingBottom:28},action:{borderWidth:1,borderColor:'#f78c26',borderRadius:10,padding:11,backgroundColor:'#FFFFFF',fontFamily:'Outfit_600SemiBold',fontSize:14,color:'#343e48',marginBottom:20},label:{fontFamily:'Outfit_600SemiBold',fontSize:14,color:'#343e48',marginBottom:7,marginTop:8},input:{minHeight:110,borderWidth:1,borderColor:'rgba(0,0,0,0.18)',borderRadius:12,padding:12,fontFamily:'Outfit_400Regular',fontSize:16,color:'#000000',backgroundColor:'#FFFFFF'},count:{alignSelf:'flex-end',fontFamily:'Outfit_400Regular',fontSize:11,color:'rgba(0,0,0,0.55)',marginTop:5},photoActions:{gap:9},photoButton:{height:48,borderWidth:1,borderColor:'rgba(0,0,0,0.16)',borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#FFFFFF'},photoButtonText:{fontFamily:'Outfit_600SemiBold',fontSize:14,color:'#343e48'},preview:{borderWidth:1,borderColor:'rgba(0,0,0,0.12)',borderRadius:14,overflow:'hidden',backgroundColor:'rgba(0,0,0,0.03)'},image:{width:'100%',height:260},remove:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderTopWidth:1,borderTopColor:'rgba(0,0,0,0.10)',backgroundColor:'#FFFFFF'},removeText:{fontFamily:'Outfit_600SemiBold',fontSize:13,color:'#343e48'},help:{fontFamily:'Outfit_400Regular',fontSize:11,color:'rgba(0,0,0,0.55)',marginTop:7,textAlign:'right'},error:{fontFamily:'Outfit_500Medium',fontSize:13,color:'#FFFFFF',backgroundColor:'#343e48',padding:11,borderRadius:10,marginTop:16},footer:{padding:16,borderTopWidth:1,borderTopColor:'rgba(0,0,0,0.10)',flexDirection:'row',gap:10},cancel:{flex:1,height:48,borderWidth:1,borderColor:'#343e48',borderRadius:12,alignItems:'center',justifyContent:'center'},cancelText:{fontFamily:'Outfit_600SemiBold',fontSize:15,color:'#343e48'},submit:{flex:1.45,height:48,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#f78c26'},submitText:{fontFamily:'Outfit_700Bold',fontSize:15,color:'#FFFFFF'},
});
