import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SupportedLanguage = 'es' | 'en';

const LANGUAGE_STORAGE_KEY = 'csy_app_language';

export const TRANSLATIONS = {
  es: {
    // Bottom Tabs Navigation
    'nav.tasks': 'Tareas',
    'nav.schedule': 'Agenda',
    'nav.team': 'Equipo',
    'nav.chat': 'Chat',
    'nav.profile': 'Perfil',

    // Perfil / Ajustes
    'profile.title': 'Mi Perfil',
    'profile.userFallback': 'Técnico CaboSystems',
    'profile.fieldOperations': 'OPERACIÓN EN CAMPO',
    'profile.myWorkOrders': 'Mis Órdenes de Servicio',
    'profile.myWorkOrdersSub': 'Consultar tareas asignadas en villa',
    'profile.checkinCheckout': 'Registrar Check-In / Check-Out',
    'profile.checkinCheckoutSub': 'Captura fotográfica y coordenadas GPS',
    
    // Ajustes de Aplicación
    'profile.appSettings': 'AJUSTES DE LA APLICACIÓN',
    'profile.language': 'Idioma / Language',
    'profile.languageSub': 'Español (México) / English (US)',
    'profile.selectLanguageTitle': 'Seleccionar Idioma',
    'profile.selectLanguageSub': 'Elige el idioma en el que deseas visualizar la aplicación',
    'profile.langEs': 'Español',
    'profile.langEsDesc': 'Español latinoamericano predeterminado',
    'profile.langEn': 'English',
    'profile.langEnDesc': 'English interface and terminology',

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
    'profile.version': 'Versión 1.2.0 (Native)',
  },
  en: {
    // Bottom Tabs Navigation
    'nav.tasks': 'Tasks',
    'nav.schedule': 'Schedule',
    'nav.team': 'Team',
    'nav.chat': 'Chat',
    'nav.profile': 'Profile',

    // Perfil / Ajustes
    'profile.title': 'My Profile',
    'profile.userFallback': 'CaboSystems Technician',
    'profile.fieldOperations': 'FIELD OPERATIONS',
    'profile.myWorkOrders': 'My Work Orders',
    'profile.myWorkOrdersSub': 'View assigned tasks in villa',
    'profile.checkinCheckout': 'Record Check-In / Check-Out',
    'profile.checkinCheckoutSub': 'Photo capture and GPS coordinates',
    
    // Ajustes de Aplicación
    'profile.appSettings': 'APP SETTINGS',
    'profile.language': 'Language / Idioma',
    'profile.languageSub': 'English (US) / Español (México)',
    'profile.selectLanguageTitle': 'Select Language',
    'profile.selectLanguageSub': 'Choose your preferred language for the application',
    'profile.langEs': 'Español',
    'profile.langEsDesc': 'Default Latin American Spanish',
    'profile.langEn': 'English',
    'profile.langEnDesc': 'English interface and terminology',

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
    'profile.version': 'Version 1.2.0 (Native)',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.es;

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: TranslationKey | string) => string;
  isSpanish: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: async () => {},
  t: (key) => key,
  isSpanish: true,
  isEnglish: false,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('es');

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        let savedLang: string | null = null;
        if (Platform.OS === 'web') {
          savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
        } else {
          savedLang = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        }

        if (savedLang === 'en' || savedLang === 'es') {
          setLanguageState(savedLang);
        }
      } catch (err) {
        console.warn('Error loading stored language:', err);
      }
    }
    loadSavedLanguage();
  }, []);

  const setLanguage = async (newLang: SupportedLanguage) => {
    try {
      setLanguageState(newLang);
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        }
      } else {
        await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, newLang);
      }
    } catch (err) {
      console.warn('Error saving language preference:', err);
    }
  };

  const t = (key: TranslationKey | string): string => {
    const dict = TRANSLATIONS[language] as Record<string, string>;
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to Spanish dictionary
    const fallback = TRANSLATIONS.es as Record<string, string>;
    if (fallback[key]) {
      return fallback[key];
    }
    return key;
  };

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
