import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { GeofenceMapCoordinates } from './VillaGeofenceMap.native';

interface Props {
  coordinates: GeofenceMapCoordinates;
  radiusMeters: number;
  onChange: (coordinates: GeofenceMapCoordinates) => void;
}

export function VillaGeofenceMap({ radiusMeters }: Props) {
  return (
    <View style={styles.frame}>
      <View style={styles.circle}><MapPin size={28} color="#f78c26" /></View>
      <Text style={styles.text}>Geocerca de {radiusMeters} m</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(52,62,72,0.18)', backgroundColor: 'rgba(52,62,72,0.06)' },
  circle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f78c26', backgroundColor: 'rgba(247,140,38,0.16)' },
  text: { color: '#343e48', fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
});
