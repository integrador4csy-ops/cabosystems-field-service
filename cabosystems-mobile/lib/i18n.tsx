import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_LANGUAGE, setCurrentLanguage, translateText, type SupportedLanguage, type TranslationParams } from './localization';
export type { SupportedLanguage } from './localization';

const LANGUAGE_STORAGE_KEY = 'csy_app_language';

export const TRANSLATIONS = {
  es: {
    // Bottom Tabs Navigation
    'nav.tasks': 'Tareas',
    'nav.checkins': 'Checks',
    'nav.schedule': 'Agenda',
    'nav.team': 'Equipo',
    'nav.chat': 'Chat',
    'nav.maps': 'Mapas',
    'nav.locations': 'Villas',
    'nav.profile': 'Perfil',

    'maps.live': 'en vivo',
    'maps.moving': 'en movimiento',
    'maps.liveStatus': 'En vivo',
    'maps.offline': 'Sin conexión',
    'maps.loading': 'Cargando ubicaciones del equipo...',
    'maps.unavailable': 'Mapa no disponible',
    'maps.retryHelp': 'Revisa tu conexión e intenta actualizar nuevamente.',
    'maps.empty': 'Sin ubicaciones disponibles',
    'maps.emptyHelp': 'Las ubicaciones aparecerán cuando el personal comience a transmitirlas.',
    'maps.refresh': 'Actualizar mapa',
    'maps.center': 'Mostrar todo el equipo',
    'maps.close': 'Cerrar detalle',
    'maps.webTitle': 'Radar disponible en la app móvil',
    'maps.webHelp': 'Abre la app en iOS o Android para consultar el mapa satelital en vivo.',
    'maps.people': 'personas con ubicación',

    'locations.title': 'Ubicación de villas',
    'locations.subtitle': 'Consulta las ubicaciones disponibles y toca una villa para ver sus detalles.',
    'locations.loading': 'Cargando villas...',
    'locations.geofenceRadius': 'Radio de geocerca',
    'locations.distance': 'Tu distancia',
    'locations.inside': 'Estás dentro de la geocerca',
    'locations.outside': 'Estás fuera de la geocerca',
    'locations.insideHelp': 'Tu ubicación actual se encuentra dentro del radio configurado para esta villa.',
    'locations.outsideHelp': 'Puedes abrir Maps para iniciar la ruta hacia la villa.',
    'locations.check': 'Comprobar mi ubicación',
    'locations.checking': 'Comprobando...',
    'locations.openMaps': 'Ver ruta en Maps',
    'locations.notConfigured': 'Ubicación pendiente',
    'locations.notConfiguredHelp': 'Un administrador debe configurar las coordenadas de esta villa desde Proyectos en la web.',
    'locations.noVillas': 'No hay villas con ubicación configurada.',
    'locations.loadError': 'No se pudieron cargar las ubicaciones. Revisa tu conexión e intenta de nuevo.',
    'locations.retry': 'Reintentar',
    'locations.back': 'Volver',
    'locations.permissionTitle': 'Permiso de ubicación',
    'locations.permissionMessage': 'Permite el acceso a tu ubicación para comprobar si estás dentro de la geocerca.',
    'locations.errorTitle': 'No se pudo abrir la ubicación',
    'locations.locationError': 'Revisa el GPS e intenta comprobar tu ubicación nuevamente.',
    'locations.mapsError': 'No se pudo abrir la aplicación de mapas.',
    'profile.villaLocations': 'Ubicaciones de villas',
    'profile.villaLocationsSub': 'Consulta geocercas y abre rutas en Maps',

    // Perfil / Ajustes
    'profile.title': 'Mi Perfil',
    'profile.userFallback': 'Técnico CaboSystems',
    'profile.fieldOperations': 'OPERACIÓN EN CAMPO',
    'profile.myWorkOrders': 'Mis Órdenes de Servicio',
    'profile.myWorkOrdersSub': 'Consultar tareas asignadas en villa',
    'profile.checkinCheckout': 'Registrar Check-in / Check-out',
    'profile.backHome': 'Volver a Tareas',
    'profile.checkinCheckoutSub': 'Captura fotográfica y coordenadas GPS',
    
    // Ajustes de Aplicación
    'profile.appSettings': 'AJUSTES DE LA APLICACIÓN',
    'profile.language': 'Idioma / Language',
    'profile.languageSub': 'Español (México) / English (US)',
    'profile.selectLanguageTitle': 'Seleccionar Idioma',
    'profile.selectLanguageSub': 'Elige el idioma en el que deseas visualizar la aplicación',
    'profile.langEs': 'Español',
    'profile.langEsDesc': 'Español latinoamericano',
    'profile.langEn': 'English',
    'profile.langEnDesc': 'English · Idioma predeterminado',

    // Soporte y Seguridad
    'profile.supportSecurity': 'SOPORTE Y SEGURIDAD',
    'profile.biometric': 'Acceso Biométrico',
    'profile.biometricEnabled': 'Habilitada para acceso rápido',
    'profile.biometricDisabled': 'Desactivada',
    'profile.changePassword': 'Cambiar Contraseña',
    'profile.changePasswordSub': 'Actualizar credenciales de acceso',
    'profile.support': 'Soporte Operativo CSY',
    'profile.supportSub': 'Ayuda técnica y reportes en campo',
    'profile.logout': 'Cerrar Sesión',
    'profile.logoutSub': 'Salir de tu cuenta en este dispositivo',

    // Modal Cerrar Sesión
    'profile.logoutModalTitle': '¿Cerrar Sesión?',
    'profile.logoutModalMsg': 'Al salir, se suspenderá la sincronización de campo hasta que vuelvas a iniciar sesión con tu cuenta.',
    'profile.cancel': 'CANCELAR',
    'profile.logoutConfirm': 'SALIR',

    // Modal Cambiar Contraseña
    'profile.changePasswordTitle': 'Cambiar Contraseña',
    'profile.changePasswordModalSub': 'Ingresa tu nueva contraseña para acceder a la aplicación.',
    'profile.newPassword': 'Nueva Contraseña',
    'profile.newPasswordPlaceholder': 'Mínimo 6 caracteres',
    'profile.confirmPassword': 'Confirmar Contraseña',
    'profile.confirmPasswordPlaceholder': 'Repite tu nueva contraseña',
    'profile.savePassword': 'GUARDAR CONTRASEÑA',
    'profile.passwordSuccess': 'Contraseña Actualizada',
    'profile.passwordSuccessMsg': 'Tu nueva contraseña ha sido guardada exitosamente.',
    'profile.passwordMismatch': 'Las contraseñas no coinciden.',
    'profile.passwordLength': 'La contraseña debe tener al menos 6 caracteres.',

    // Modal Soporte
    'profile.supportModalTitle': 'Soporte CaboSystems',
    'profile.supportModalSub': 'Canales de atención directa para el equipo de campo',
    'profile.callCentral': 'Llamar a Central de Operaciones',
    'profile.whatsappSupport': 'WhatsApp Soporte Técnico',
    'profile.close': 'CERRAR',

    // Notificaciones / Fotos
    'Notificaciones': 'Notificaciones',
    'profile.avatarSuccess': 'Foto de perfil actualizada correctamente.',
    'profile.avatarError': 'No se pudo subir la foto de perfil. Intenta de nuevo.',
    'profile.errorTitle': 'Error',
    'profile.successTitle': 'Éxito',

    // Roles
    'role.admin': 'Administrador General',
    'role.supervisor_instalacion': 'Supervisor de Instalación',
    'role.instalador': 'Técnico Instalador',
    'role.aux_instalacion': 'Auxiliar de Instalación',
    'role.integrador': 'Integrador',
    'role.aux_integracion': 'Auxiliar de Integración',
    'role.infraestructura': 'Técnico de Infraestructura',
    'role.aux_infraestructura': 'Auxiliar de Infraestructura',
    'role.servicios': 'Técnico de Servicios',
    'role.aux_servicios': 'Auxiliar de Servicios',
    'role.aux_operaciones': 'Auxiliar de Operaciones',
    'role.supervisor': 'Supervisor Operativo',
    'role.tecnico': 'Técnico de Campo',

    // Footer
    'profile.footerTagline': 'Tecnología e Integración Residencial • Los Cabos, B.C.S.',
    'profile.version': 'Versión 1.2.1 (Native)',
  },
  en: {
    // Bottom Tabs Navigation
    'nav.tasks': 'Tasks',
    'nav.checkins': 'Checks',
    'nav.schedule': 'Schedule',
    'nav.team': 'Team',
    'nav.chat': 'Chat',
    'nav.maps': 'Maps',
    'nav.locations': 'Villas',
    'nav.profile': 'Profile',

    'maps.live': 'live',
    'maps.moving': 'moving',
    'maps.liveStatus': 'Live',
    'maps.offline': 'Offline',
    'maps.loading': 'Loading team locations...',
    'maps.unavailable': 'Map unavailable',
    'maps.retryHelp': 'Check your connection and try refreshing again.',
    'maps.empty': 'No locations available',
    'maps.emptyHelp': 'Locations will appear when team members begin transmitting them.',
    'maps.refresh': 'Refresh map',
    'maps.center': 'Show the full team',
    'maps.close': 'Close details',
    'maps.webTitle': 'Radar available in the mobile app',
    'maps.webHelp': 'Open the iOS or Android app to view the live map.',
    'maps.people': 'people sharing a location',

    'locations.title': 'Villa locations',
    'locations.subtitle': 'Browse available locations and tap a villa to view its details.',
    'locations.loading': 'Loading villas...',
    'locations.geofenceRadius': 'Geofence radius',
    'locations.distance': 'Your distance',
    'locations.inside': 'You are inside the geofence',
    'locations.outside': 'You are outside the geofence',
    'locations.insideHelp': 'Your current location is within the radius configured for this villa.',
    'locations.outsideHelp': 'Open Maps to start directions to the villa.',
    'locations.check': 'Check my location',
    'locations.checking': 'Checking...',
    'locations.openMaps': 'View route in Maps',
    'locations.notConfigured': 'Location pending',
    'locations.notConfiguredHelp': 'An administrator must configure this villa’s coordinates from Projects on the web.',
    'locations.noVillas': 'No villas have a configured location.',
    'locations.loadError': 'Locations could not be loaded. Check your connection and try again.',
    'locations.retry': 'Try again',
    'locations.back': 'Back',
    'locations.permissionTitle': 'Location permission',
    'locations.permissionMessage': 'Allow location access to check whether you are inside the geofence.',
    'locations.errorTitle': 'Location could not be opened',
    'locations.locationError': 'Check GPS and try checking your location again.',
    'locations.mapsError': 'The maps application could not be opened.',
    'profile.villaLocations': 'Villa locations',
    'profile.villaLocationsSub': 'View geofences and open routes in Maps',

    // Perfil / Ajustes
    'profile.title': 'My Profile',
    'profile.userFallback': 'CaboSystems Technician',
    'profile.fieldOperations': 'FIELD OPERATIONS',
    'profile.myWorkOrders': 'My Work Orders',
    'profile.myWorkOrdersSub': 'View assigned tasks in villa',
    'profile.checkinCheckout': 'Record Check-in / Check-out',
    'profile.backHome': 'Back to Tasks',
    'profile.checkinCheckoutSub': 'Photo capture and GPS coordinates',
    
    // Ajustes de Aplicación
    'profile.appSettings': 'APP SETTINGS',
    'profile.language': 'Language / Idioma',
    'profile.languageSub': 'English (US) / Español (México)',
    'profile.selectLanguageTitle': 'Select Language',
    'profile.selectLanguageSub': 'Choose your preferred language for the application',
    'profile.langEs': 'Español',
    'profile.langEsDesc': 'Latin American Spanish',
    'profile.langEn': 'English',
    'profile.langEnDesc': 'English · Default language',

    // Soporte y Seguridad
    'profile.supportSecurity': 'SUPPORT & SECURITY',
    'profile.biometric': 'Biometric Access',
    'profile.biometricEnabled': 'Enabled for fast sign-in',
    'profile.biometricDisabled': 'Disabled',
    'profile.changePassword': 'Change Password',
    'profile.changePasswordSub': 'Update login credentials',
    'profile.support': 'CSY Operational Support',
    'profile.supportSub': 'Technical assistance and field reporting',
    'profile.logout': 'Log Out',
    'profile.logoutSub': 'Sign out from this device',

    // Modal Cerrar Sesión
    'profile.logoutModalTitle': 'Log Out?',
    'profile.logoutModalMsg': 'Signing out will suspend field synchronization until you sign in again with your account.',
    'profile.cancel': 'CANCEL',
    'profile.logoutConfirm': 'LOG OUT',

    // Modal Cambiar Contraseña
    'profile.changePasswordTitle': 'Change Password',
    'profile.changePasswordModalSub': 'Enter your new password to access the app.',
    'profile.newPassword': 'New Password',
    'profile.newPasswordPlaceholder': 'Minimum 6 characters',
    'profile.confirmPassword': 'Confirm Password',
    'profile.confirmPasswordPlaceholder': 'Repeat your new password',
    'profile.savePassword': 'SAVE PASSWORD',
    'profile.passwordSuccess': 'Password Updated',
    'profile.passwordSuccessMsg': 'Your new password has been saved successfully.',
    'profile.passwordMismatch': 'Passwords do not match.',
    'profile.passwordLength': 'Password must be at least 6 characters.',

    // Modal Soporte
    'profile.supportModalTitle': 'CaboSystems Support',
    'profile.supportModalSub': 'Direct contact channels for field staff',
    'profile.callCentral': 'Call Operations Dispatch',
    'profile.whatsappSupport': 'Technical Support WhatsApp',
    'profile.close': 'CLOSE',

    // Notificaciones / Fotos
    'Notificaciones': 'Notifications',
    'profile.avatarSuccess': 'Profile picture updated successfully.',
    'profile.avatarError': 'Could not upload profile picture. Please try again.',
    'profile.errorTitle': 'Error',
    'profile.successTitle': 'Success',

    // Roles
    'role.admin': 'General Administrator',
    'role.supervisor_instalacion': 'Installation Supervisor',
    'role.instalador': 'Installation Technician',
    'role.aux_instalacion': 'Installation Assistant',
    'role.integrador': 'Systems Integrator',
    'role.aux_integracion': 'Integration Assistant',
    'role.infraestructura': 'Infrastructure Technician',
    'role.aux_infraestructura': 'Infrastructure Assistant',
    'role.servicios': 'Service Technician',
    'role.aux_servicios': 'Service Assistant',
    'role.aux_operaciones': 'Operations Assistant',
    'role.supervisor': 'Operations Supervisor',
    'role.tecnico': 'Field Technician',

    // Footer
    'profile.footerTagline': 'Residential Integration & Technology • Los Cabos, B.C.S.',
    'profile.version': 'Version 1.2.1 (Native)',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.es;

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: TranslationKey | string, params?: TranslationParams) => string;
  isSpanish: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
  t: (key, params) => translateText(DEFAULT_LANGUAGE, (TRANSLATIONS.en as Record<string, string>)[key] ?? key, params),
  isSpanish: false,
  isEnglish: true,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const selectionRevision = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    const revision = selectionRevision.current;
    let active = true;
    async function loadSavedLanguage() {
      try {
        let savedLang: string | null = null;
        if (Platform.OS === 'web') {
          savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
        } else {
          savedLang = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        }

        if (active && revision === selectionRevision.current && (savedLang === 'en' || savedLang === 'es')) {
          setCurrentLanguage(savedLang);
          setLanguageState(savedLang);
        }
      } catch (err) {
        console.warn('Error loading stored language:', err);
      }
    }
    loadSavedLanguage();
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback(async (newLang: SupportedLanguage) => {
    try {
      selectionRevision.current++;
      setCurrentLanguage(newLang);
      setLanguageState(newLang);
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (Platform.OS === 'web') {
          if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        } else {
          await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, newLang);
        }
      });
      await saveQueue.current;
    } catch (err) {
      console.warn('Error saving language preference:', err);
    }
  }, []);

  const t = useCallback((key: TranslationKey | string, params?: TranslationParams): string => {
    const dict = TRANSLATIONS[language] as Record<string, string>;
    if (dict && dict[key]) {
      return translateText(language, dict[key], params);
    }
    const fallback = TRANSLATIONS.en as Record<string, string>;
    if (fallback[key]) {
      return translateText(language, fallback[key], params);
    }
    return translateText(language, key, params);
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isSpanish: language === 'es',
        isEnglish: language === 'en',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  return useContext(LanguageContext);
}
