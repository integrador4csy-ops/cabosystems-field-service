import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Crosshair, MapPin, Minus, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/lib/i18n';
import { VillaGeofenceMap, type GeofenceMapCoordinates } from './VillaGeofenceMap';

export interface GeofenceDraft extends GeofenceMapCoordinates {
  radiusMeters: number;
}

interface Props {
  visible: boolean;
  step: 'prompt' | 'map';
  villaName: string;
  draft: GeofenceDraft;
  onDraftChange: (draft: GeofenceDraft) => void;
  onShowMap: () => void;
  onUseCurrentLocation: () => void;
  onSkip: () => void;
  onBack: () => void;
  onConfirm: () => void;
  saving?: boolean;
}

const clampRadius = (value: number) => Math.max(25, Math.min(5000, value));

export function VillaGeofenceRegistrationModal(props: Props) {
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const setRadius = (radiusMeters: number) => props.onDraftChange({ ...props.draft, radiusMeters: clampRadius(radiusMeters) });

  return (
    <Modal visible={props.visible} animationType="slide" transparent onRequestClose={props.step === 'map' ? props.onBack : props.onSkip}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {props.step === 'prompt' ? (
            <View style={styles.prompt}>
              <View style={styles.icon}><MapPin size={28} color="#f78c26" /></View>
              <Text style={styles.title}>{tr('Esta villa todavía no tiene ubicación')}</Text>
              <Text style={styles.body}>{tr('¿Quieres registrar la ubicación de {value0} usando el GPS de este check-in?', { value0: props.villaName })}</Text>
              <Pressable style={styles.primaryButton} onPress={props.onShowMap}>
                <Text style={styles.primaryText}>{tr('Registrar ubicación')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={props.onSkip}>
                <Text style={styles.secondaryText}>{tr('Ahora no')}</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.editor} showsVerticalScrollIndicator={false}>
              <View style={styles.headingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{tr('Configurar geocerca')}</Text>
                  <Text style={styles.body}>{tr('Mueve el punto para marcar el centro. El círculo muestra el área válida para el check-in.')}</Text>
                </View>
                <Pressable accessibilityLabel={tr('Cerrar')} style={styles.closeButton} onPress={props.onBack}><X size={22} color="#343e48" /></Pressable>
              </View>
              <VillaGeofenceMap
                coordinates={props.draft}
                radiusMeters={props.draft.radiusMeters}
                onChange={(coordinates) => props.onDraftChange({ ...props.draft, ...coordinates })}
              />
              <Pressable style={styles.locationButton} onPress={props.onUseCurrentLocation}>
                <Crosshair size={19} color="#343e48" />
                <Text style={styles.locationText}>{tr('Usar mi ubicación')}</Text>
              </Pressable>
              <View style={styles.radiusCard}>
                <View>
                  <Text style={styles.radiusLabel}>{tr('Radio de la geocerca')}</Text>
                  <Text style={styles.radiusValue}>{Math.round(props.draft.radiusMeters)} m</Text>
                </View>
                <View style={styles.radiusControls}>
                  <Pressable style={styles.radiusButton} onPress={() => setRadius(props.draft.radiusMeters - 25)}><Minus size={20} color="#343e48" /></Pressable>
                  <Pressable style={styles.radiusButton} onPress={() => setRadius(props.draft.radiusMeters + 25)}><Plus size={20} color="#343e48" /></Pressable>
                </View>
              </View>
              <Pressable disabled={props.saving} style={[styles.primaryButton, props.saving && styles.disabled]} onPress={props.onConfirm}>
                <Text style={styles.primaryText}>{tr('Guardar geocerca y continuar')}</Text>
              </Pressable>
              <Pressable disabled={props.saving} style={styles.secondaryButton} onPress={props.onBack}>
                <Text style={styles.secondaryText}>{tr('Volver')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', paddingTop: 22, paddingHorizontal: 20 },
  prompt: { alignItems: 'stretch', gap: 12 },
  editor: { gap: 14, paddingBottom: 4 },
  icon: { width: 58, height: 58, borderRadius: 29, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247,140,38,0.14)' },
  title: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 23, lineHeight: 29, textAlign: 'left' },
  body: { color: 'rgba(52,62,72,0.82)', fontFamily: 'Outfit_400Regular', fontSize: 16, lineHeight: 23 },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: 'rgba(52,62,72,0.16)' },
  primaryButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#f78c26', paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(52,62,72,0.2)', paddingHorizontal: 18 },
  secondaryText: { color: '#343e48', fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  locationButton: { minHeight: 48, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(52,62,72,0.2)', backgroundColor: '#FFFFFF' },
  locationText: { color: '#343e48', fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  radiusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, padding: 15, backgroundColor: 'rgba(52,62,72,0.06)' },
  radiusLabel: { color: 'rgba(52,62,72,0.78)', fontFamily: 'Outfit_500Medium', fontSize: 14 },
  radiusValue: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 24, marginTop: 2 },
  radiusControls: { flexDirection: 'row', gap: 9 },
  radiusButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(52,62,72,0.18)', backgroundColor: '#FFFFFF' },
  disabled: { opacity: 0.55 },
});
