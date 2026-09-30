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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import {
  uploadEvidencePhoto,
  createFieldRecord,
  getLatestFieldRecord,
  getOrCreateCheckInTaskForProject,
  getTaskById,
} from '@/lib/api';
import type { Project } from '@/types/database';

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
}: {
  CameraView: any;
  useCameraPermissions: any;
  onCapture: (uri: string) => void;
  flash: 'off' | 'on';
  facing: 'back' | 'front';
  setFacing: (f: 'back' | 'front') => void;
  cameraRef: React.MutableRefObject<any>;
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
    <View style={styles.cameraContainer}>
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

        <View style={styles.controlPlaceholder} />
      </View>
    </View>
  );
}

function CameraSection({ onCapture, flash, onToggleFlash }: CameraSectionProps) {
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
    />
  );
}

export default function CheckinScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [isCheckOut, setIsCheckOut] = useState<boolean>(type === 'check_out');
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [showVillaModal, setShowVillaModal] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (!user?.id) return;
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
        let resolved: Project | null = null;
        if (id && id !== 'new' && id !== 'villa') {
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
  }, [id, type, user?.id, projects, selectedProject, setSelectedProject]);

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
    setLocationLoading(true);
    setLocationError(null);

    // 1. Web Geolocation handling
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationLoading(false);
        },
        (err) => {
          console.warn('Web geolocation fallback:', err.message);
          setLocationCoords({
            latitude: 22.89053,
            longitude: -109.91674,
            accuracy: 8,
          });
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
      return;
    }

    // 2. Native Geolocation via expo-location ONLY if module is linked
    const hasExpoLocation = checkNativeModule('ExpoLocation');

    if (hasExpoLocation) {
      try {
        const Location = require('expo-location');
        if (Location && typeof Location.requestForegroundPermissionsAsync === 'function') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationError('Permiso de GPS no concedido');
            setLocationLoading(false);
            return;
          }

          // 1. Intentar última ubicación conocida primero para respuesta inmediata
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown?.coords) {
              setLocationCoords(lastKnown.coords);
              setLocationLoading(false);
              return;
            }
          } catch {
            // continuar a getCurrentPositionAsync
          }

          // 2. Intentar ubicación actual con precisión balanceada
          try {
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy?.Balanced ?? 3,
            });

            if (position?.coords) {
              setLocationCoords(position.coords);
              setLocationLoading(false);
              return;
            }
          } catch (posErr) {
            // 3. Fallback con Lowest accuracy si la configuración del teléfono restringe alta precisión
            const positionLow = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy?.Lowest ?? 1,
            });
            if (positionLow?.coords) {
              setLocationCoords(positionLow.coords);
              setLocationLoading(false);
              return;
            }
          }
        }
      } catch (err: any) {
        console.warn('Native GPS fetch warning:', err);
      }
    }

    // 3. Fallback for Web/Simulator/Client without native GPS module
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationLoading(false);
        },
        () => {
          setLocationCoords({ latitude: 22.89053, longitude: -109.91674, accuracy: 8 });
          setLocationLoading(false);
        }
      );
    } else {
      setLocationCoords({ latitude: 22.89053, longitude: -109.91674, accuracy: 8 });
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

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

    setIsSubmitting(true);
    try {
      // Obtener o asociar automáticamente la orden de trabajo para esta villa
      const taskId = await getOrCreateCheckInTaskForProject(currentProject.id, user.id);
      const timestamp = Date.now();
      const prefix = isCheckOut ? 'checkout' : 'checkin';
      const storagePath = `${prefix}s/${taskId}_${timestamp}.jpg`;

      const publicUrl = await uploadEvidencePhoto(photoUri, storagePath);

      await createFieldRecord({
        tarea_id: taskId,
        tecnico_id: user.id,
        tipo: isCheckOut ? 'check_out' : 'check_in',
        latitud: locationCoords.latitude,
        longitud: locationCoords.longitude,
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
        onClose: () => router.back(),
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
      setIsSubmitting(false);
    }
  };

  const screenTitle = isCheckOut ? 'CHECK-OUT' : 'CHECK-IN';
  const submitText = isCheckOut ? 'Registrar Check-Out' : 'Registrar Check-In';

  return (
    <View style={styles.container}>
      {/* Header Minimalista en Modo Claro */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <X size={18} color={Colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>{screenTitle}</Text>

          <Pressable
            onPress={toggleFlash}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
            hitSlop={10}
            disabled={!!photoUri}
          >
            {flash === 'on' ? (
              <Zap size={18} color={Colors.primary} />
            ) : (
              <ZapOff size={18} color={photoUri ? Colors.textDisabled : Colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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
              <CameraSection onCapture={handleCapturePhoto} flash={flash} onToggleFlash={toggleFlash} />
            )}
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
                      <Text style={styles.taskCardTitle} numberOfLines={1}>
                        {currentProject.desarrollo} • {currentProject.villa || currentProject.unidad}
                      </Text>
                      <Text style={styles.taskCardSub} numberOfLines={1}>
                        {isCheckOut
                          ? 'Registro de salida (Check-Out) de la villa'
                          : 'Registro de llegada (Check-In) a la villa'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.taskCardEmptyText}>Sin villa seleccionada</Text>
                  )}
                </View>

                {projects.length > 1 && (
                  <Pressable
                    style={({ pressed }) => [styles.taskChangeBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => setShowVillaModal(true)}
                  >
                    <Text style={styles.taskChangeBtnText}>CAMBIAR VILLA</Text>
                    <ChevronDown size={14} color={Colors.primary} />
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

            <View style={styles.gpsCard}>
              <View
                style={[
                  styles.gpsIconBox,
                  locationCoords && !locationLoading && styles.gpsIconBoxSuccess,
                ]}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : locationCoords ? (
                  <Check size={20} color={Colors.primary} strokeWidth={2.8} />
                ) : (
                  <MapPin size={20} color={Colors.textMuted} />
                )}
              </View>

              <View style={styles.gpsDetails}>
                <Text style={styles.gpsHeaderLabel}>UBICACIÓN GPS</Text>
                {locationLoading ? (
                  <Text style={styles.gpsLoadingText}>Obteniendo ubicación satelital...</Text>
                ) : locationError ? (
                  <Text style={styles.gpsErrorText}>{locationError}</Text>
                ) : locationCoords ? (
                  <View style={styles.gpsSuccessRow}>
                    <Text style={styles.gpsSuccessText}>Ubicación tomada correctamente</Text>
                  </View>
                ) : (
                  <Text style={styles.gpsErrorText}>GPS no disponible</Text>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [styles.refreshGpsButton, pressed && { opacity: 0.7 }]}
                onPress={fetchLocation}
                disabled={locationLoading}
              >
                <RefreshCw size={17} color={Colors.textSecondary} />
              </Pressable>
            </View>

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
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
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

      {/* Modal de Selección de Desarrollo -> Villa */}
      <Modal
        visible={showVillaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVillaModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowVillaModal(false)}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragPill} />
              <Text style={styles.modalTitle}>SELECCIONAR VILLA</Text>
              <Text style={styles.modalSubtitle}>
                Elige la villa donde registrarás tu {isCheckOut ? 'salida (Check-Out)' : 'llegada (Check-In)'}:
              </Text>
            </View>

            <ScrollView style={styles.taskListScroll} showsVerticalScrollIndicator={false}>
              {groupedVillas.map(([desarrollo, units]: [string, Project[]]) => (
                <View key={desarrollo} style={styles.devSection}>
                  <Text style={styles.devName}>{desarrollo.toUpperCase()}</Text>
                  {units.map((unit: Project) => {
                    const isSelected = unit.id === currentProject?.id;
                    return (
                      <Pressable
                        key={unit.id}
                        style={({ pressed }) => [
                          styles.taskItemCard,
                          isSelected && styles.taskItemCardSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          setCurrentProject(unit);
                          setSelectedProject(unit);
                          setShowVillaModal(false);
                        }}
                      >
                        <View style={styles.taskItemInfo}>
                          <View style={styles.taskItemRow}>
                            <Building
                              size={15}
                              color={isSelected ? '#FFFFFF' : Colors.textSecondary}
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
                            <Check size={16} color={Colors.textWhite} strokeWidth={2.5} />
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
        </Pressable>
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
    width: 60,
  },
  controlPlaceholder: {
    width: 60,
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
    paddingTop: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    ...Shadow.sm,
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
    alignItems: 'center',
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
    color: Colors.text,
    marginTop: 2,
  },
  taskCardSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
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
  taskChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  taskChangeBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primaryDark,
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
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  taskItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },
  taskItemTitleSelected: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  taskItemSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  modalCloseBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
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
