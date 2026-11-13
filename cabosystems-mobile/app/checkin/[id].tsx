import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import { getLocale } from '@/lib/localization';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  X,
  Zap,
  ZapOff,
  Camera as CameraIcon,
  RotateCcw,
  MapPin,
  Check,
  RefreshCw,
  Send,
  Upload,
  Sparkles,
  Server,
  Cable,
  Building,
  Briefcase,
  ChevronDown,
  Layers,
  AlertCircle,
  Maximize2,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import {
  uploadEvidencePhoto,
  createFieldRecord,
  getTaskById,
  registerMissingVillaGeofence,
} from '@/lib/api';
import { getLatestOfflineFieldRecord as getLatestFieldRecord, queueFieldRecord } from '@/lib/fieldSync';
import { optimizeEvidencePhoto } from '@/lib/evidencePhoto';
import type { Project } from '@/types/database';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { VillaGeofenceRegistrationModal, type GeofenceDraft } from '@/components/VillaGeofenceRegistrationModal';
import { DEFAULT_VILLA_GEOFENCE_RADIUS_METERS, hasVillaCoordinates } from '@/lib/villaGeofence';

function checkNativeModule(moduleName: string): boolean {
  if (Platform.OS === 'web') return false;
  try {
    if (typeof requireOptionalNativeModule === 'function') {
      return requireOptionalNativeModule(moduleName) != null;
    }
  } catch {
    // ignore
  }
  try {
    return !!((globalThis as any)?.expo?.modules?.[moduleName]);
  } catch {
    return false;
  }
}

const PRESET_EVIDENCES = [
  {
    id: 'rack',
    label: 'Rack / Conmutador',
    icon: Server,
    uri: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'cable',
    label: 'Cableado y Nodos',
    icon: Cable,
    uri: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'site',
    label: 'Acceso a Sitio',
    icon: Building,
    uri: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=800&auto=format&fit=crop',
  },
];

interface CameraSectionProps {
  onCapture: (uri: string) => void;
  flash: 'off' | 'on';
  onToggleFlash: () => void;
  fullscreen?: boolean;
  onExpand?: () => void;
}

function FallbackCameraSection({ onCapture }: { onCapture: (uri: string) => void }) {
  const { t: tr } = useInterfaceTranslation();
  const fileInputRef = useRef<any>(null);

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onCapture(url);
    }
  };

  const handleGenerateSamplePhoto = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 640, 480);
        ctx.strokeStyle = '#f78c26';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, 600, 440);
        ctx.strokeStyle = '#343e48';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(320, 20);
        ctx.lineTo(320, 460);
        ctx.moveTo(20, 240);
        ctx.lineTo(620, 240);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('CABOSYSTEMS FIELD EVIDENCE', 40, 60);
        ctx.fillStyle = '#f78c26';
        ctx.font = '14px sans-serif';
        ctx.fillText(tr("FECHA: {value0}", { value0: new Date().toLocaleString() }), 40, 90);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText(tr("ESTADO: TELEMETRÍA Y COORDENADAS VALID️ADAS"), 40, 120);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onCapture(dataUrl);
        return;
      }
    }

    // Default remote image for mobile simulator/fallback
    onCapture(PRESET_EVIDENCES[0].uri);
  };

  return (
    <View style={styles.fallbackCaptureContainer}>
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      <CameraIcon size={38} color={Colors.primary} />
      <Text style={styles.fallbackCaptureTitle}>{tr("Captura de Evidencia Fotográfica")}</Text>
      <Text style={styles.fallbackCaptureSubtitle}>
        {Platform.OS === 'web'
          ? tr("Toma una foto con tu cámara web/móvil o selecciona una evidencia de prueba.")
          : tr("Módulo nativo no disponible en este cliente. Selecciona una evidencia de campo para continuar:")}
      </Text>

      {Platform.OS === 'web' && (
        <Pressable
          style={({ pressed }) => [styles.webButtonPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <Upload size={16} color={Colors.textWhite} />
          <Text style={styles.webButtonText}>{tr("Tomar / Subir Foto Local")}</Text>
        </Pressable>
      )}

      <View style={styles.presetsGrid}>
        {PRESET_EVIDENCES.map((preset) => {
          const Icon = preset.icon;
          return (
            <Pressable
              key={preset.id}
              style={({ pressed }) => [styles.presetCard, pressed && { opacity: 0.85 }]}
              onPress={() => onCapture(preset.uri)}
            >
              <Icon size={18} color={Colors.primary} />
              <Text style={styles.presetText} numberOfLines={1}>
                {tr(preset.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [styles.sampleButton, pressed && { opacity: 0.85 }]}
        onPress={handleGenerateSamplePhoto}
      >
        <Sparkles size={14} color={Colors.textWhite} />
        <Text style={styles.sampleButtonText}>{tr("Generar Evidencia Telemetría CSY")}</Text>
      </Pressable>
    </View>
  );
}

function NativeCameraViewInner({
  CameraView,
  useCameraPermissions,
  onCapture,
  flash,
  facing,
  setFacing,
  cameraRef,
  fullscreen,
  onExpand,
}: {
  CameraView: any;
  useCameraPermissions: any;
  onCapture: (uri: string) => void;
  flash: 'off' | 'on';
  facing: 'back' | 'front';
  setFacing: (f: 'back' | 'front') => void;
  cameraRef: React.MutableRefObject<any>;
  fullscreen?: boolean;
  onExpand?: () => void;
}) {
  const { t: tr } = useInterfaceTranslation();
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, null];

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch (err: any) {
      console.error('Error capturing photo:', err);
      Alert.alert(tr("Error"), tr("No se pudo capturar la fotografía"));
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={48} color={Colors.primary} />
        <Text style={styles.permissionTitle}>{tr("Permiso de Cámara Requerido")}</Text>
        <Text style={styles.permissionSubtitle}>{tr("Es necesario capturar evidencia fotográfica para registrar el evento en sitio.")}</Text>
        <Pressable
          style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>{tr("Habilitar Cámara")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.cameraContainer, fullscreen && styles.fullscreenCamera]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flash === 'on'}
      />
      <View style={styles.cameraOverlay} pointerEvents="none">
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>

      <View style={styles.cameraControls}>
        <Pressable
          style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        >
          <RotateCcw size={22} color={Colors.textWhite} />
          <Text style={styles.controlText}>{tr("GIRAR")}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.captureButton, pressed && { opacity: 0.8 }]}
          onPress={handleCapture}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>

        {onExpand ? <Pressable accessibilityRole="button" accessibilityLabel={tr("Abrir cámara a pantalla completa")} onPress={onExpand} style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}>
          <Maximize2 size={22} color={Colors.textWhite} />
          <Text style={styles.controlText} numberOfLines={1}>{tr("AMPLIAR")}</Text>
        </Pressable> : <View style={styles.controlPlaceholder} />}
      </View>
    </View>
  );
}

function CameraSection({ onCapture, flash, onToggleFlash, fullscreen, onExpand }: CameraSectionProps) {
  const [CameraView, setCameraView] = useState<any>(null);
  const [useCameraPermissions, setUseCameraPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasNativeCamera, setHasNativeCamera] = useState(false);
  const cameraRef = useRef<any>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  useEffect(() => {
    let mounted = true;
    const isAvailable = checkNativeModule('ExpoCamera');

    if (!isAvailable) {
      setHasNativeCamera(false);
      setLoading(false);
      return;
    }

    try {
      const mod = require('expo-camera');
      if (mod && mod.CameraView && mod.useCameraPermissions) {
        if (mounted) {
          setCameraView(() => mod.CameraView);
          setUseCameraPermissions(() => mod.useCameraPermissions);
          setHasNativeCamera(true);
          setLoading(false);
        }
      } else {
        if (mounted) {
          setHasNativeCamera(false);
          setLoading(false);
        }
      }
    } catch {
      if (mounted) {
        setHasNativeCamera(false);
        setLoading(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!hasNativeCamera || !CameraView || !useCameraPermissions) {
    return <FallbackCameraSection onCapture={onCapture} />;
  }

  return (
    <NativeCameraViewInner
      CameraView={CameraView}
      useCameraPermissions={useCameraPermissions}
      onCapture={onCapture}
      flash={flash}
      facing={facing}
      setFacing={setFacing}
      cameraRef={cameraRef}
      fullscreen={fullscreen}
      onExpand={onExpand}
    />
  );
}

export default function CheckinScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { t: tr } = useInterfaceTranslation();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const leaveCheckin = () => {
    if (embedded) router.replace('/(tabs)');
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [cameraActive, setCameraActive] = useState(false);
  const manualVillaRef = useRef<{ key: string; projectId: string } | null>(null);
  useFocusEffect(useCallback(() => {
    setCameraActive(true);
    return () => { manualVillaRef.current = null; setCameraActive(false); };
  }, []));
  const { user } = useAuth();
  const villaSelectionKey = JSON.stringify([user?.id, id, type]);

  const [isCheckOut, setIsCheckOut] = useState<boolean>(type === 'check_out');
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [showVillaModal, setShowVillaModal] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraFullscreen, setCameraFullscreen] = useState(false);
  useEffect(() => { if (!cameraActive) setCameraFullscreen(false); }, [cameraActive]);
  const [notes, setNotes] = useState('');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const locationTimestamp = useRef(0);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [geofenceStep, setGeofenceStep] = useState<'closed' | 'prompt' | 'map'>('closed');
  const [pendingSubmissionLocation, setPendingSubmissionLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geofenceDraft, setGeofenceDraft] = useState<GeofenceDraft>({ latitude: 0, longitude: 0, radiusMeters: DEFAULT_VILLA_GEOFENCE_RADIUS_METERS });

  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    onClose?: () => void;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const handleCloseFeedbackModal = () => {
    const callback = feedbackModal.onClose;
    setFeedbackModal((prev) => ({ ...prev, visible: false }));
    if (callback) {
      callback();
    }
  };

  useEffect(() => {
    let mounted = true;
    async function determineTypeAndVilla() {
      if (!cameraActive || !user?.id) return;
      setProjectLoading(true);
      try {
        // 1. Detectar si la siguiente acción es salida o llegada
        if (type) {
          setIsCheckOut(type === 'check_out');
        } else {
          const latest = await getLatestFieldRecord(user.id);
          if (mounted) {
            setIsCheckOut(latest?.tipo === 'check_in');
          }
        }

        // 2. Identificar automáticamente el Desarrollo y Villa correspondiente
        const manual = manualVillaRef.current;
        let resolved: Project | null = manual?.key === villaSelectionKey
          ? projects.find(project => project.id === manual.projectId) || null : null;
        if (!resolved && id && id !== 'new' && id !== 'villa') {
          // Buscar si id es directamente el id de un proyecto
          resolved = projects.find((p) => p.id === id) || null;
          // Si no es un id de proyecto, verificar si es un id de tarea
          if (!resolved) {
            try {
              const taskDetail = await getTaskById(String(id));
              if (taskDetail?.proyecto_id) {
                resolved = projects.find((p) => p.id === taskDetail.proyecto_id) || null;
              }
            } catch {
              // no es una tarea
            }
          }
        }

        // Por defecto usar la villa activa de la app (Header / Dashboard) o la primera disponible
        if (!resolved) {
          resolved = selectedProject || projects[0] || null;
        }

        if (mounted) {
          // A user may choose a villa while an earlier route lookup is still pending.
          const latestManual = manualVillaRef.current;
          if (latestManual?.key === villaSelectionKey) {
            resolved = projects.find(project => project.id === latestManual.projectId) || resolved;
          }
          setCurrentProject(resolved);
          if (resolved) {
            setSelectedProject(resolved);
          }
        }
      } catch (err) {
        console.warn('Error loading checkin context:', err);
      } finally {
        if (mounted) setProjectLoading(false);
      }
    }

    determineTypeAndVilla();
    return () => {
      mounted = false;
    };
  }, [id, type, user?.id, projects, selectedProject, setSelectedProject, cameraActive, villaSelectionKey]);

  const groupedVillas = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const project of projects) {
      const key = project.desarrollo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(project);
    }
    return Array.from(map.entries());
  }, [projects]);

  const fetchLocation = useCallback(async () => {
    setLocationLoading(true); setLocationError(null); setLocationCoords(null);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) throw new Error('GPS no disponible en este navegador.');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));
        locationTimestamp.current = position.timestamp;
        setLocationCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        return position.coords;
      } else {
        if (!checkNativeModule('ExpoLocation')) throw new Error(tr("GPS no disponible. Instala la compilación actual de la app."));
        const Location = require('expo-location') as typeof import('expo-location');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error(tr("Permiso de GPS no concedido."));
        const recent = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
        const position = recent || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) throw new Error(tr("No se pudo obtener una ubicación válida."));
        locationTimestamp.current = position.timestamp;
        setLocationCoords(position.coords);
        return position.coords;
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : tr("No se pudo obtener el GPS. Vuelve a intentarlo."));
      return null;
    } finally { setLocationLoading(false); }
  }, [tr]);

  useEffect(() => {
    if (cameraActive) void fetchLocation();
  }, [fetchLocation, cameraActive]);

  const handleCapturePhoto = (uri: string) => {
    setPhotoUri(uri);
  };

  const handleRetakePhoto = () => {
    setPhotoUri(null);
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const resetCompletedCheck = () => {
    setPhotoUri(null);
    setNotes('');
    setFlash('off');
    setCameraFullscreen(false);
    setPendingSubmissionLocation(null);
    setGeofenceStep('closed');
  };

  const completeSubmission = async (
    submissionLocation: { latitude: number; longitude: number },
    geofence?: GeofenceDraft,
  ) => {
    if (submittingRef.current || !photoUri || !user?.id || !currentProject?.id) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (Platform.OS !== 'web') {
        await queueFieldRecord({
          owner: user.id,
          projectId: currentProject.id,
          photoUri,
          tipo: isCheckOut ? 'check_out' : 'check_in',
          latitude: submissionLocation.latitude,
          longitude: submissionLocation.longitude,
          comments: notes.trim() || null,
          geofence: !isCheckOut ? geofence : undefined,
        });
        resetCompletedCheck();
        setFeedbackModal({
          visible: true,
          type: 'success',
          title: tr('Registro guardado en el dispositivo'),
          message: geofence
            ? tr('El check-in y la geocerca quedaron guardados. Se enviarán automáticamente cuando la app tenga conexión.')
            : tr('La foto, la ubicación y la hora quedaron guardadas. Se enviará automáticamente cuando la app esté abierta y tenga conexión. Puedes consultar los pendientes en el aviso de sincronización.'),
          onClose: leaveCheckin,
        });
        return;
      }

      const timestamp = Date.now();
      const prefix = isCheckOut ? 'checkout' : 'checkin';
      const storagePath = `${prefix}s/${currentProject.id}_${user.id}_${timestamp}.jpg`;
      const publicUrl = await uploadEvidencePhoto(await optimizeEvidencePhoto(photoUri), storagePath);
      const created = await createFieldRecord({
        proyecto_id: currentProject.id,
        tarea_id: null,
        tecnico_id: user.id,
        tipo: isCheckOut ? 'check_out' : 'check_in',
        latitud: submissionLocation.latitude,
        longitud: submissionLocation.longitude,
        foto_url: publicUrl,
        comentarios: notes.trim() ? notes.trim() : null,
      });
      if (!isCheckOut && geofence) {
        await registerMissingVillaGeofence(created.id, currentProject.id, geofence.latitude, geofence.longitude, geofence.radiusMeters);
      }

      const projectVilla = currentProject.villa || currentProject.unidad;
      resetCompletedCheck();
      setFeedbackModal({
        visible: true,
        type: 'success',
        title: isCheckOut ? tr('Check-Out Registrado') : tr('Check-In Registrado'),
        message: isCheckOut
          ? tr('Se registró tu salida de {value0} ({value1}) con éxito.', { value0: projectVilla, value1: currentProject.desarrollo })
          : tr('Se registró tu llegada a {value0} ({value1}) con éxito.', { value0: projectVilla, value1: currentProject.desarrollo }),
        onClose: leaveCheckin,
      });
    } catch (err: any) {
      console.error('Error submitting field record:', err);
      setFeedbackModal({ visible: true, type: 'error', title: tr('Error al Guardar'), message: err?.message || tr('Ocurrió un error al registrar en la base de datos.') });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!photoUri) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: tr("Foto Requerida"),
        message: tr("Debes capturar o seleccionar una evidencia fotográfica."),
      });
      return;
    }

    if (!locationCoords) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: tr("GPS Requerido"),
        message: tr("Se requieren coordenadas GPS válidas para el registro."),
      });
      return;
    }

    if (!user?.id) {
      setFeedbackModal({
        visible: true,
        type: 'error',
        title: tr("Sesión no Válida"),
        message: tr("Sesión no válida o expirada. Por favor vuelve a iniciar sesión."),
      });
      return;
    }

    if (!currentProject?.id) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: tr("Selecciona una Villa"),
        message: tr("No hay una villa seleccionada para asociar el registro."),
      });
      return;
    }

    try {
      const submissionLocation = Date.now() - locationTimestamp.current > 120_000 ? await fetchLocation() : locationCoords;
      if (!submissionLocation) throw new Error(tr("No se pudo validar una ubicación reciente. Comprueba el GPS y vuelve a intentarlo."));
      if (!isCheckOut && !hasVillaCoordinates(currentProject)) {
        const coordinates = { latitude: submissionLocation.latitude, longitude: submissionLocation.longitude };
        setPendingSubmissionLocation(coordinates);
        setGeofenceDraft({ ...coordinates, radiusMeters: DEFAULT_VILLA_GEOFENCE_RADIUS_METERS });
        setGeofenceStep('prompt');
        return;
      }
      await completeSubmission(submissionLocation);
    } catch (err: any) {
      setFeedbackModal({
        visible: true,
        type: 'error',
        title: tr("Error al Guardar"),
        message: err?.message || tr("Ocurrió un error al registrar en la base de datos."),
      });
    }
  };

  const continueWithoutGeofence = () => {
    const location = pendingSubmissionLocation;
    setGeofenceStep('closed');
    setPendingSubmissionLocation(null);
    if (location) void completeSubmission(location);
  };

  const confirmGeofence = () => {
    const location = pendingSubmissionLocation;
    setGeofenceStep('closed');
    setPendingSubmissionLocation(null);
    if (location) void completeSubmission(location, geofenceDraft);
  };

  const submitText = isCheckOut ? tr("Registrar Check-out") : tr("Registrar Check-in");
  const bottomInset = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET);
  const submitControl = <Pressable
    style={({ pressed }) => [
      styles.submitButton,
      (!photoUri || !locationCoords || isSubmitting || !currentProject) && styles.submitDisabled,
      pressed && { opacity: 0.9 },
    ]}
    onPress={handleSubmit}
    disabled={!photoUri || !locationCoords || isSubmitting || !currentProject}
  >
    {isSubmitting ? <><ActivityIndicator size="small" color={Colors.textWhite} /><Text style={styles.submitButtonText}>{tr("Guardando registro...")}</Text></> : <><Send size={18} color={Colors.textWhite} /><Text style={styles.submitButtonText}>{submitText}</Text></>}
  </Pressable>;

  return (
    <View style={styles.container}>
      <VillaGeofenceRegistrationModal
        visible={geofenceStep !== 'closed'}
        step={geofenceStep === 'map' ? 'map' : 'prompt'}
        villaName={currentProject ? `${currentProject.villa || currentProject.unidad} · ${currentProject.desarrollo}` : tr('Villa')}
        draft={geofenceDraft}
        onDraftChange={setGeofenceDraft}
        onShowMap={() => setGeofenceStep('map')}
        onUseCurrentLocation={() => pendingSubmissionLocation && setGeofenceDraft((draft) => ({ ...draft, ...pendingSubmissionLocation }))}
        onSkip={continueWithoutGeofence}
        onBack={() => setGeofenceStep('prompt')}
        onConfirm={confirmGeofence}
        saving={isSubmitting}
      />
      <View style={{ height: headerHeight }}><HeaderCaboSystems showProjectSelector={false} /></View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: embedded
            ? bottomInset + BOTTOM_BAR_HEIGHT + 92
            : Math.max(insets.bottom, Spacing.md) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cameraWrapper}>
            {photoUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.previewBadge}>
                  <Check size={14} color={Colors.textWhite} />
                  <Text style={styles.previewBadgeText}>{tr("EVIDENCIA CAPTURADA")}</Text>
                </View>
                <View style={styles.previewControls}>
                  <Pressable
                    style={({ pressed }) => [styles.retakeButton, pressed && { opacity: 0.8 }]}
                    onPress={handleRetakePhoto}
                  >
                    <RotateCcw size={16} color={Colors.textWhite} />
                    <Text style={styles.retakeText}>{tr("REPETIR / CAMBIAR")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              cameraActive && !cameraFullscreen ? <CameraSection onCapture={handleCapturePhoto} flash={flash} onToggleFlash={toggleFlash} onExpand={() => setCameraFullscreen(true)} /> : null
            )}
              <Pressable accessibilityRole="button" accessibilityLabel={flash === 'on' ? tr("Apagar flash") : tr("Encender flash")} accessibilityState={{ selected: flash === 'on' }} onPress={toggleFlash} style={[styles.photoToolButton, styles.photoFlashButton]}>
                {flash === 'on' ? <Zap size={21} color="#FFFFFF" /> : <ZapOff size={21} color="#FFFFFF" />}
              </Pressable>
              {photoUri && <Pressable accessibilityRole="button" accessibilityLabel={tr("Abrir cámara a pantalla completa")} onPress={() => setCameraFullscreen(true)} style={[styles.photoToolButton, styles.photoExpandButton]}>
                <Maximize2 size={21} color="#FFFFFF" />
              </Pressable>}
          </View>

          <View style={styles.infoSection}>
            {/* Contexto de la Villa / Proyecto */}
            <View style={styles.taskCard}>
              <View style={styles.taskCardHeader}>
                <View style={styles.taskCardIconBox}>
                  <Building size={20} color={Colors.primary} />
                </View>
                <View style={styles.taskCardDetails}>
                  <Text style={styles.taskCardHeaderLabel}>{tr("DESARROLLO Y VILLA")}</Text>
                  {projectLoading && !currentProject ? (
                    <View style={styles.taskCardLoadingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.taskCardLoadingText}>{tr("Identificando villa...")}</Text>
                    </View>
                  ) : currentProject ? (
                    <>
                      <Text style={styles.taskCardTitle} numberOfLines={1}>
                        {currentProject.desarrollo} · {currentProject.villa || currentProject.unidad}
                      </Text>
                      <View style={styles.taskCardModeRow}>
                        <View style={styles.taskCardModeDot} />
                        <Text style={styles.taskCardSub} numberOfLines={1}>
                          {isCheckOut ? tr("Check-out de la villa") : tr("Check-in a la villa")}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.taskCardEmptyText}>{tr("Sin villa seleccionada")}</Text>
                  )}
                </View>
                <View style={styles.taskCardControls}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gpsIconButton,
                      locationCoords && styles.gpsIconButtonSuccess,
                      locationError && styles.gpsIconButtonError,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={async () => {
                      const coords = await fetchLocation();
                      if (coords) {
                        Alert.alert(
                          tr("Ubicación GPS"),
                          tr("Latitud: {value0}\nLongitud: {value1}\nEstado: Satélite conectado correctamente.", { value0: coords.latitude.toFixed(5), value1: coords.longitude.toFixed(5) })
                        );
                      } else {
                        Alert.alert(tr('Error de GPS'), tr("No se pudo actualizar la ubicación. Comprueba el permiso y la señal de GPS."));
                      }
                    }}
                    disabled={locationLoading}
                    accessibilityRole="button"
                    accessibilityLabel={tr("Ubicación GPS")}
                  >
                    {locationLoading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <MapPin
                        size={17}
                        color={locationCoords || locationError ? Colors.primary : '#343e48'}
                        strokeWidth={2.4}
                      />
                    )}
                    {locationCoords && <View style={styles.gpsDotSuccess} />}
                  </Pressable>
                  {projects.length > 1 && (
                    <Pressable
                      style={({ pressed }) => [styles.taskChangeBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={tr("Cambiar villa")}
                      onPress={() => { Keyboard.dismiss(); setShowVillaModal(true); }}
                    >
                      <Text style={styles.taskChangeBtnText}>{tr("CAMBIAR")}</Text>
                      <ChevronDown size={13} color="#343e48" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {projects.length === 0 && !projectLoading && (
              <View style={styles.taskWarningBox}>
                <AlertCircle size={16} color={Colors.primary} />
                <Text style={styles.taskWarningText}>{tr("No se encontraron villas activas registradas en el sistema.")}</Text>
              </View>
            )}

            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>
                {isCheckOut
                  ? tr("NOTAS DE SALIDA Y CIERRE DE VILLA")
                  : tr('NOTAS DE LLEGADA A LA VILLA')}
              </Text>
              <TextInput
                style={styles.notesInput}
                placeholder={
                  isCheckOut
                    ? tr("Villa cerrada, equipos operando y salida del instalador...")
                    : tr('Llegada a la villa, acceso por caseta principal e inicio...')
                }
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
          {!embedded && <View style={styles.footer}>{submitControl}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
      {embedded && <View style={[styles.embeddedActionDock, { bottom: bottomInset + BOTTOM_BAR_HEIGHT + 8 }]}>{submitControl}</View>}

      <Modal visible={cameraFullscreen && cameraActive} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraFullscreen(false)}>
        <View style={styles.fullscreenPage}>
          {cameraFullscreen && cameraActive ? <CameraSection fullscreen flash={flash} onToggleFlash={toggleFlash} onCapture={uri => { handleCapturePhoto(uri); setCameraFullscreen(false); }} /> : null}
          <View style={[styles.photoToolbar, { top: insets.top + 12 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Cerrar cámara completa")} onPress={() => setCameraFullscreen(false)} style={styles.photoToolButton}><X size={23} color="#FFFFFF" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={flash === 'on' ? tr("Apagar flash") : tr("Encender flash")} onPress={toggleFlash} style={styles.photoToolButton}>{flash === 'on' ? <Zap size={21} color="#FFFFFF" /> : <ZapOff size={21} color="#FFFFFF" />}</Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Desarrollo -> Villa */}
      <Modal
        visible={showVillaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVillaModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={tr("Cerrar selección de villa")} onPress={() => setShowVillaModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragPill} />
              <Text style={styles.modalTitle}>{tr("SELECCIONAR VILLA")}</Text>
              <Text style={styles.modalSubtitle}>{tr("Elige la villa donde registrarás tu ")}{isCheckOut ? tr('salida (Check-Out)') : tr('llegada (Check-In)')}:
              </Text>
            </View>

            <ScrollView style={styles.taskListScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {groupedVillas.map(([desarrollo, units]: [string, Project[]]) => (
                <View key={desarrollo} style={styles.devSection}>
                  <Text style={styles.devName}>{desarrollo.toUpperCase()}</Text>
                  {units.map((unit: Project) => {
                    const isSelected = unit.id === currentProject?.id;
                    return (
                      <Pressable
                        key={unit.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={({ pressed }) => [
                          styles.taskItemCard,
                          isSelected && styles.taskItemCardSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          manualVillaRef.current = { key: villaSelectionKey, projectId: unit.id };
                          setCurrentProject(unit);
                          setSelectedProject(unit);
                          setShowVillaModal(false);
                        }}
                      >
                        <View style={styles.taskItemInfo}>
                          <View style={styles.taskItemRow}>
                            <Building
                              size={15}
                              color={isSelected ? '#FFFFFF' : '#343e48'}
                            />
                            <Text
                              style={[styles.taskItemTitle, isSelected && styles.taskItemTitleSelected]}
                            >
                              {unit.villa || unit.unidad}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.taskItemSubtitle,
                              isSelected && styles.taskItemSubtitleSelected,
                            ]}
                          >
                            {desarrollo}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.taskItemCheck}>
                            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setShowVillaModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>{tr("CERRAR")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación / Alerta con Estilo CaboSystems */}
      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseFeedbackModal}
      >
        <View style={styles.feedbackBackdrop}>
          <View style={styles.feedbackCard}>
            <View
              style={[
                styles.feedbackIconCircle,
                feedbackModal.type === 'success' && styles.feedbackIconSuccess,
                feedbackModal.type === 'warning' && styles.feedbackIconWarning,
                feedbackModal.type === 'error' && styles.feedbackIconError,
              ]}
            >
              {feedbackModal.type === 'success' ? (
                <Check size={32} color={Colors.success} strokeWidth={2.8} />
              ) : (
                <AlertCircle
                  size={32}
                  color={feedbackModal.type === 'error' ? Colors.error : Colors.warning}
                  strokeWidth={2.5}
                />
              )}
            </View>

            <Text style={styles.feedbackTitle}>{tr(feedbackModal.title)}</Text>
            <Text style={styles.feedbackMessage}>{tr(feedbackModal.message)}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.feedbackButton,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleCloseFeedbackModal}
            >
              <Text style={styles.feedbackButtonText}>{tr("ENTENDIDO")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenPage: { flex: 1, backgroundColor: '#000000' },
  fullscreenCamera: { height: '100%' },
  photoToolbar: { position: 'absolute', top: 12, right: 12, left: 12, flexDirection: 'row', justifyContent: 'space-between' },
  photoToolButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  photoFlashButton: { position: 'absolute', top: 12, right: 12 },
  photoExpandButton: { position: 'absolute', bottom: 12, right: 12 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  headerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  cameraWrapper: {
    minHeight: 260,
    backgroundColor: '#000000',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.3)',
  },
  cameraContainer: {
    flex: 1,
    height: 260,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: 20,
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 20,
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 84,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 84,
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  controlButton: {
    alignItems: 'center',
    gap: Spacing.xs,
    width: 72,
  },
  controlPlaceholder: {
    width: 72,
  },
  controlText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    color: Colors.textWhite,
    letterSpacing: 1,
  },
  captureButton: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.full,
    borderWidth: 4,
    borderColor: Colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textWhite,
  },
  previewContainer: {
    height: 260,
    position: 'relative',
  },
  previewBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retakeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },
  permissionContainer: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: '#000000',
  },
  permissionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.textWhite,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  permissionButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.textWhite,
  },
  fallbackCaptureContainer: {
    padding: Spacing.lg,
    backgroundColor: '#000000',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fallbackCaptureTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: Colors.textWhite,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  fallbackCaptureSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 17,
  },
  webButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  webButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textWhite,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    width: '100%',
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.5)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    maxWidth: '48%',
  },
  presetText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textWhite,
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(52, 62, 72, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(247, 140, 38, 0.5)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sampleButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  infoSection: {
    paddingHorizontal: 12,
    gap: 8,
  },
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...Shadow.xs,
  },
  gpsIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsIconBoxSuccess: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  gpsDetails: {
    flex: 1,
  },
  gpsHeaderLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  gpsSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gpsSuccessText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  gpsLoadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  gpsErrorText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  refreshGpsButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundDark,
  },
  notesSection: {
    gap: Spacing.xs,
  },
  notesLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  notesInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: 14,
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.text,
    minHeight: 82,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  embeddedActionDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    minHeight: 52,
    paddingVertical: 12,
    gap: Spacing.sm,
    ...Shadow.xs,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.textWhite,
  },
  taskCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  taskCardIconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCardDetails: {
    flex: 1,
    minWidth: 0,
  },
  taskCardHeaderLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  taskCardTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
    marginTop: 2,
  },
  taskCardModeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  taskCardModeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  taskCardSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginTop: 0,
  },
  taskCardLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  taskCardLoadingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  taskCardEmptyText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  taskCardControls: { alignItems: 'flex-end', gap: 6 },
  gpsIconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.20)',
  },
  gpsIconButtonSuccess: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  gpsIconButtonError: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.primary,
  },
  gpsDotSuccess: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  taskChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.20)',
  },
  taskChangeBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: '#343e48',
  },
  taskWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginBottom: Spacing.sm,
  },
  taskWarningText: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.warningText,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    maxHeight: '75%',
    ...Shadow.lg,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  modalDragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(52,62,72,0.25)',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#000000',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#343e48',
    marginTop: 2,
    textAlign: 'center',
  },
  taskListScroll: {
    marginVertical: Spacing.sm,
  },
  devSection: {
    marginBottom: Spacing.md,
  },
  devName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: '#343e48',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  taskItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.20)',
    marginBottom: Spacing.sm,
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskItemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  taskItemInfo: {
    flex: 1,
  },
  taskItemTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#000000',
  },
  taskItemTitleSelected: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  taskItemSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#343e48',
    marginTop: 2,
  },
  taskItemSubtitleSelected: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  taskItemCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.xs,
  },
  modalCloseBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  feedbackBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...Shadow.lg,
  },
  feedbackIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackIconSuccess: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  feedbackIconWarning: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  feedbackIconError: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  feedbackTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  feedbackMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: Spacing.xs,
  },
  feedbackButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.xs,
  },
  feedbackButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
});
