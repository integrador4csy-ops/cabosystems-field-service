import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type MapPressEvent } from 'react-native-maps';

export interface GeofenceMapCoordinates {
  latitude: number;
  longitude: number;
}

interface Props {
  coordinates: GeofenceMapCoordinates;
  radiusMeters: number;
  onChange: (coordinates: GeofenceMapCoordinates) => void;
}

export function VillaGeofenceMap({ coordinates, radiusMeters, onChange }: Props) {
  const mapRef = useRef<MapView>(null);
  const update = (event: MapPressEvent) => onChange(event.nativeEvent.coordinate);
  const updateFromDrag = (event: { nativeEvent: { coordinate: GeofenceMapCoordinates } }) => onChange(event.nativeEvent.coordinate);

  return (
    <View style={styles.frame}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...coordinates, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
        userInterfaceStyle="light"
        onPress={update}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <Circle
          center={coordinates}
          radius={radiusMeters}
          fillColor="rgba(247,140,38,0.18)"
          strokeColor="#f78c26"
          strokeWidth={2}
        />
        <Marker
          coordinate={coordinates}
          draggable
          pinColor="#f78c26"
          onDragEnd={updateFromDrag}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 300,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.18)',
    backgroundColor: 'rgba(52,62,72,0.06)',
  },
});
