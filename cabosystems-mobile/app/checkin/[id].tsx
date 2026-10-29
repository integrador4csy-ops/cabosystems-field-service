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
  getOrCreateCheckInTaskForProject,
  getTaskById,
} from '@/lib/api';
import { getLatestOfflineFieldRecord as getLatestFieldRecord, queueFieldRecord } from '@/lib/fieldSync';
import { optimizeEvidencePhoto } from '@/lib/evidencePhoto';
import type { Project } from '@/types/database';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';

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
        ctx.fillText(`FECHA: ${new Date().toLocaleString()}`, 40, 90);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText('ESTADO: TELEMETRÍA Y COORDENADAS VALID️ADAS', 40, 120);
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
      <Text style={styles.fallbackCaptureTitle}>Captura de Evidencia Fotográfica</Text>
      <Text style={styles.fallbackCaptureSubtitle}>
        {Platform.OS === 'web'
          ? 'Toma una foto con tu cámara web/móvil o selecciona una evidencia de prueba.'
          : 'Módulo nativo no disponible en este cliente. Selecciona una evidencia de campo para continuar:'}
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
          <Text style={styles.webButtonText}>Tomar / Subir Foto Local</Text>
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
                {preset.label}
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
        <Text style={styles.sampleButtonText}>Generar Evidencia Telemetría CSY</Text>
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
      Alert.alert('Error', 'No se pudo capturar la fotografía');
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
        <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
        <Text style={styles.permissionSubtitle}>
          Es necesario capturar evidencia fotográfica para registrar el evento en sitio.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Habilitar Cámara</Text>
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
          <Text style={styles.controlText}>GIRAR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.captureButton, pressed && { opacity: 0.8 }]}
          onPress={handleCapture}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>

        {onExpand ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir cámara a pantalla completa" onPress={onExpand} style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}>
          <Maximize2 size={22} color={Colors.textWhite} />
          <Text style={styles.controlText} numberOfLines={1}>AMPLIAR</Text>
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
        if (!checkNativeModule('ExpoLocation')) throw new Error('GPS no disponible. Instala la compilación actual de la app.');
        const Location = require('expo-location') as typeof import('expo-location');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Permiso de GPS no concedido.');
        const recent = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
        const position = recent || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) throw new Error('No se pudo obtener una ubicación válida.');
        locationTimestamp.current = position.timestamp;
        setLocationCoords(position.coords);
        return position.coords;
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'No se pudo obtener el GPS. Vuelve a intentarlo.');
      return null;
    } finally { setLocationLoading(false); }
  }, []);

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

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!photoUri) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: 'Foto Requerida',
        message: 'Debes capturar o seleccionar una evidencia fotográfica.',
      });
      return;
    }

    if (!locationCoords) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: 'GPS Requerido',
        message: 'Se requieren coordenadas GPS válidas para el registro.',
      });
      return;
    }

    if (!user?.id) {
      setFeedbackModal({
        visible: true,
        type: 'error',
        title: 'Sesión no Válida',
        message: 'Sesión no válida o expirada. Por favor vuelve a iniciar sesión.',
      });
      return;
    }

    if (!currentProject?.id) {
      setFeedbackModal({
        visible: true,
        type: 'warning',
        title: 'Selecciona una Villa',
        message: 'No hay una villa seleccionada para asociar el registro.',
      });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const submissionLocation = Date.now() - locationTimestamp.current > 120_000 ? await fetchLocation() : locationCoords;
      if (!submissionLocation) throw new Error('No se pudo validar una ubicación reciente. Comprueba el GPS y vuelve a intentarlo.');
      if (Platform.OS !== 'web') {
        await queueFieldRecord({ owner: user.id, projectId: currentProject.id, photoUri,
          tipo: isCheckOut ? 'check_out' : 'check_in', latitude: submissionLocation.latitude,
          longitude: submissionLocation.longitude, comments: notes.trim() || null });
        setFeedbackModal({ visible: true, type: 'success', title: 'Registro guardado en el dispositivo',
          message: 'La foto, la ubicación y la hora quedaron guardadas. Se enviará automáticamente cuando la app esté abierta y tenga conexión. Puedes consultar los pendientes en el aviso de sincronización.', onClose: leaveCheckin });
        return;
      }
      // Obtener o asociar automáticamente la orden de trabajo para esta villa
      const taskId = await getOrCreateCheckInTaskForProject(currentProject.id, user.id);
      const timestamp = Date.now();
      const prefix = isCheckOut ? 'checkout' : 'checkin';
      const storagePath = `${prefix}s/${taskId}_${timestamp}.jpg`;

      const publicUrl = await uploadEvidencePhoto(await optimizeEvidencePhoto(photoUri), storagePath);

      await createFieldRecord({
        tarea_id: taskId,
        tecnico_id: user.id,
        tipo: isCheckOut ? 'check_out' : 'check_in',
        latitud: submissionLocation.latitude,
        longitud: submissionLocation.longitude,
        foto_url: publicUrl,
        comentarios: notes.trim() ? notes.trim() : null,
      });

      const projectVilla = currentProject.villa || currentProject.unidad;
      setFeedbackModal({
        visible: true,
        type: 'success',
        title: isCheckOut ? 'Check-Out Registrado' : 'Check-In Registrado',
        message: isCheckOut
          ? `Se registró tu salida de ${projectVilla} (${currentProject.desarrollo}) con éxito.`
          : `Se registró tu llegada a ${projectVilla} (${currentProject.desarrollo}) con éxito.`,
        onClose: leaveCheckin,
      });
    } catch (err: any) {
      console.error('Error submitting field record:', err);
      setFeedbackModal({
        visible: true,
        type: 'error',
        title: 'Error al Guardar',
        message: err?.message || 'Ocurrió un error al registrar en la base de datos.',
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitText = isCheckOut ? 'Registrar Check-out' : 'Registrar Check-in';

  return (
    <View style={styles.container}>
      <View style={{ height: headerHeight }}><HeaderCaboSystems showProjectSelector={false} /></View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: embedded
            ? Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET) + BOTTOM_BAR_HEIGHT + Spacing.xl
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
                  <Text style={styles.previewBadgeText}>EVIDENCIA CAPTURADA</Text>
                </View>
                <View style={styles.previewControls}>
                  <Pressable
                    style={({ pressed }) => [styles.retakeButton, pressed && { opacity: 0.8 }]}
                    onPress={handleRetakePhoto}
                  >
                    <RotateCcw size={16} color={Colors.textWhite} />
                    <Text style={styles.retakeText}>REPETIR / CAMBIAR</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              cameraActive && !cameraFullscreen ? <CameraSection onCapture={handleCapturePhoto} flash={flash} onToggleFlash={toggleFlash} onExpand={() => setCameraFullscreen(true)} /> : null
            )}
              <Pressable accessibilityRole="button" accessibilityLabel={flash === 'on' ? 'Apagar flash' : 'Encender flash'} accessibilityState={{ selected: flash === 'on' }} onPress={toggleFlash} style={[styles.photoToolButton, styles.photoFlashButton]}>
                {flash === 'on' ? <Zap size={21} color="#FFFFFF" /> : <ZapOff size={21} color="#FFFFFF" />}
              </Pressable>
              {photoUri && <Pressable accessibilityRole="button" accessibilityLabel="Abrir cámara a pantalla completa" onPress={() => setCameraFullscreen(true)} style={[styles.photoToolButton, styles.photoExpandButton]}>
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
                  <Text style={styles.taskCardHeaderLabel}>DESARROLLO Y VILLA</Text>
                  {projectLoading && !currentProject ? (
                    <View style={styles.taskCardLoadingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.taskCardLoadingText}>Identificando villa...</Text>
                    </View>
                  ) : currentProject ? (
                    <>
                      <Text style={styles.taskCardTitle}>
                        {currentProject.desarrollo}
                      </Text>
                      <Text style={styles.taskCardUnit}>
                        {currentProject.villa || currentProject.unidad}
                      </Text>
                      <Text style={styles.taskCardSub}>
                        {isCheckOut
                          ? 'Registro de salida (Check-Out) de la villa'
                          : 'Registro de llegada (Check-In) a la villa'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.taskCardEmptyText}>Sin villa seleccionada</Text>
                  )}
                </View>
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
                        'Ubicación GPS',
                        `Latitud: ${coords.latitude.toFixed(5)}\nLongitud: ${coords.longitude.toFixed(5)}\nEstado: Satélite conectado correctamente.`
                      );
                    } else {
                      Alert.alert('Error de GPS', 'No se pudo actualizar la ubicación. Comprueba el permiso y la señal de GPS.');
                    }
                  }}
                  disabled={locationLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Ubicación GPS"
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
              </View>
              <View style={styles.taskCardActionsRow}>
                {projects.length > 1 && (
                  <Pressable
                    style={({ pressed }) => [styles.taskChangeBtn, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar villa"
                    onPress={() => { Keyboard.dismiss(); setShowVillaModal(true); }}
                  >
                    <Text style={styles.taskChangeBtnText}>CAMBIAR VILLA</Text>
                    <ChevronDown size={14} color="#343e48" />
                  </Pressable>
                )}
              </View>
            </View>

            {projects.length === 0 && !projectLoading && (
              <View style={styles.taskWarningBox}>
                <AlertCircle size={16} color={Colors.primary} />
                <Text style={styles.taskWarningText}>
                  No se encontraron villas activas registradas en el sistema.
                </Text>
              </View>
            )}

            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>
                {isCheckOut
                  ? 'NOTAS DE SALIDA Y CIERRE DE VILLA'
                  : 'NOTAS DE LLEGADA A LA VILLA'}
              </Text>
              <TextInput
                style={styles.notesInput}
                placeholder={
                  isCheckOut
                    ? 'Villa cerrada, equipos operando y salida del instalador...'
                    : 'Llegada a la villa, acceso por caseta principal e inicio...'
                }
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                (!photoUri || !locationCoords || isSubmitting || !currentProject) &&
                  styles.submitDisabled,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleSubmit}
              disabled={!photoUri || !locationCoords || isSubmitting || !currentProject}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                  <Text style={styles.submitButtonText}>Guardando registro...</Text>
                </>
              ) : (
                <>
                  <Send size={18} color={Colors.textWhite} />
                  <Text style={styles.submitButtonText}>{submitText}</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={cameraFullscreen && cameraActive} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraFullscreen(false)}>
        <View style={styles.fullscreenPage}>
          {cameraFullscreen && cameraActive ? <CameraSection fullscreen flash={flash} onToggleFlash={toggleFlash} onCapture={uri => { handleCapturePhoto(uri); setCameraFullscreen(false); }} /> : null}
          <View style={[styles.photoToolbar, { top: insets.top + 12 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar cámara completa" onPress={() => setCameraFullscreen(false)} style={styles.photoToolButton}><X size={23} color="#FFFFFF" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={flash === 'on' ? 'Apagar flash' : 'Encender flash'} onPress={toggleFlash} style={styles.photoToolButton}>{flash === 'on' ? <Zap size={21} color="#FFFFFF" /> : <ZapOff size={21} color="#FFFFFF" />}</Pressable>
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
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar selección de villa" onPress={() => setShowVillaModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragPill} />
              <Text style={styles.modalTitle}>SELECCIONAR VILLA</Text>
              <Text style={styles.modalSubtitle}>
                Elige la villa donde registrarás tu {isCheckOut ? 'salida (Check-Out)' : 'llegada (Check-In)'}:
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
              <Text style={styles.modalCloseBtnText}>CERRAR</Text>
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

            <Text style={styles.feedbackTitle}>{feedbackModal.title}</Text>
            <Text style={styles.feedbackMessage}>{feedbackModal.message}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.feedbackButton,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleCloseFeedbackModal}
            >
              <Text style={styles.feedbackButtonText}>ENTENDIDO</Text>
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
    minHeight: 320,
    backgroundColor: '#000000',
    margin: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.3)',
  },
  cameraContainer: {
    flex: 1,
    height: 340,
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
    bottom: 90,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 90,
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
    paddingVertical: Spacing.md,
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
    width: 68,
    height: 68,
    borderRadius: BorderRadius.full,
    borderWidth: 4,
    borderColor: Colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textWhite,
  },
  previewContainer: {
    height: 340,
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
    height: 340,
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
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
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
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  notesInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.text,
    minHeight: 80,
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
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
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    ...Shadow.xs,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  taskCardIconBox: {
    width: 36,
    height: 36,
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
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  taskCardTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
    marginTop: 2,
  },
  taskCardUnit: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.text,
    marginTop: 2,
  },
  taskCardSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 1,
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
  taskCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  gpsIconButton: {
    width: 48,
    height: 48,
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
    minHeight: 48,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.20)',
  },
  taskChangeBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
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
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
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
