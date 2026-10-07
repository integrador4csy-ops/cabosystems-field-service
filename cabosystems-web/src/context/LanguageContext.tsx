import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type SupportedLanguage = 'es' | 'en';

const LANGUAGE_STORAGE_KEY = 'csy_web_language';

export const WEB_TRANSLATIONS = {
  es: {
    // Sidebar
    'sidebar.operationsAndStaff': 'Operaciones y Personal',
    'sidebar.radar': 'Radar Satelital',
    'sidebar.collaborators': 'Colaboradores',
    'sidebar.collaboratorsBadge': 'Equipo',
    'sidebar.invitations': 'Invitaciones',
    'sidebar.invitationsBadge': 'Activas',
    'sidebar.invite': 'Invitar Colaborador',
    'sidebar.inviteBadge': '+ Nuevo',
    'sidebar.chat': 'Chat de Equipo',
    'sidebar.chatLive': 'En Vivo',
    'sidebar.newMessages': 'nuevos',
    'sidebar.newMessage': 'nuevo',
    'sidebar.editProfile': 'Editar Perfil',
    'sidebar.language': 'Idioma / Language',
    'sidebar.languageCurrent': 'Español',
    'sidebar.logout': 'Cerrar Sesión',
    'sidebar.login': 'Iniciar Sesión',
    'sidebar.profileOptions': 'Opciones de perfil',
    'sidebar.superAdmin': 'Super Administrador',

    // Header
    'header.location': 'Los Cabos, B.C.S.',
    'header.searchPlaceholder': 'Buscar técnico por nombre o correo...',
    'header.online': 'en línea',
    'header.inRoute': 'en ruta',
    'header.offline': 'offline',
    'header.onlineTitle': 'Técnicos conectados con señal activa',
    'header.inRouteTitle': 'Técnicos en movimiento/ruta (>12 km/h)',
    'header.offlineTitle': 'Técnicos sin señal reciente (>15 min)',

    // Modal Editar Perfil / Ajustes
    'modal.profileTitle': 'Editar Perfil y Ajustes',
    'modal.profileSubtitle': 'Personaliza tu nombre, foto visible y preferencia de idioma',
    'modal.profilePhoto': 'Foto de Perfil',
    'modal.changePhoto': 'Cambiar Foto',
    'modal.deletePhoto': 'Eliminar Foto',
    'modal.uploadDropzone': 'Haz clic para subir o arrastra tu foto aquí',
    'modal.uploadHint': 'PNG, JPG o WEBP desde tu dispositivo (máx. 5MB)',
    'modal.adminName': 'Nombre del Administrador',
    'modal.adminNamePlaceholder': 'Ej. Carlos Fregoso',
    'modal.languagePref': 'Idioma del Sistema',
    'modal.languagePrefDesc': 'Selecciona el idioma para la visualización del panel web',
    'modal.spanish': 'Español (Latinoamérica)',
    'modal.english': 'English (United States)',
    'modal.cancel': 'Cancelar',
    'modal.save': 'Guardar Cambios',
    'modal.saving': 'Guardando...',
    'modal.saveSuccess': 'Perfil y preferencias actualizados con éxito.',
    'modal.saveError': 'Error al guardar cambios.',
    'modal.emptyName': 'El nombre no puede estar vacío.',
    'modal.invalidImage': 'Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).',
    'modal.imageTooLarge': 'La imagen es demasiado grande. Tamaño máximo: 5 MB.',

    // Selector Rápido de Idioma
    'lang.selectLanguage': 'Cambiar Idioma',
    'lang.es': 'Español',
    'lang.en': 'English',
  },
  en: {
    // Sidebar
    'sidebar.operationsAndStaff': 'Operations & Personnel',
    'sidebar.radar': 'Satellite Radar',
    'sidebar.collaborators': 'Collaborators',
    'sidebar.collaboratorsBadge': 'Team',
    'sidebar.invitations': 'Invitations',
    'sidebar.invitationsBadge': 'Active',
    'sidebar.invite': 'Invite Collaborator',
    'sidebar.inviteBadge': '+ New',
    'sidebar.chat': 'Team Chat',
    'sidebar.chatLive': 'Live',
    'sidebar.newMessages': 'new',
    'sidebar.newMessage': 'new',
    'sidebar.editProfile': 'Edit Profile',
    'sidebar.language': 'Language / Idioma',
    'sidebar.languageCurrent': 'English',
    'sidebar.logout': 'Log Out',
    'sidebar.login': 'Log In',
    'sidebar.profileOptions': 'Profile options',
    'sidebar.superAdmin': 'Super Administrator',

    // Header
    'header.location': 'Los Cabos, B.C.S.',
    'header.searchPlaceholder': 'Search technician by name or email...',
    'header.online': 'online',
    'header.inRoute': 'in route',
    'header.offline': 'offline',
    'header.onlineTitle': 'Technicians connected with active signal',
    'header.inRouteTitle': 'Technicians in transit/route (>12 km/h)',
    'header.offlineTitle': 'Technicians with no recent signal (>15 min)',

    // Modal Editar Perfil / Ajustes
    'modal.profileTitle': 'Edit Profile & Settings',
    'modal.profileSubtitle': 'Customize your name, profile photo and language preferences',
    'modal.profilePhoto': 'Profile Picture',
    'modal.changePhoto': 'Change Photo',
    'modal.deletePhoto': 'Remove Photo',
    'modal.uploadDropzone': 'Click to upload or drag your photo here',
    'modal.uploadHint': 'PNG, JPG or WEBP from your device (max 5MB)',
    'modal.adminName': 'Administrator Name',
    'modal.adminNamePlaceholder': 'E.g. Carlos Fregoso',
    'modal.languagePref': 'System Language',
    'modal.languagePrefDesc': 'Select the language for the web dashboard interface',
    'modal.spanish': 'Spanish (Latin America)',
    'modal.english': 'English (United States)',
    'modal.cancel': 'Cancel',
    'modal.save': 'Save Changes',
    'modal.saving': 'Saving...',
    'modal.saveSuccess': 'Profile and preferences updated successfully.',
    'modal.saveError': 'Error saving changes.',
    'modal.emptyName': 'Name cannot be empty.',
    'modal.invalidImage': 'Please select a valid image file (PNG, JPG, WEBP).',
    'modal.imageTooLarge': 'Image is too large. Maximum size: 5 MB.',

    // Selector Rápido de Idioma
    'lang.selectLanguage': 'Change Language',
    'lang.es': 'Spanish',
    'lang.en': 'English',
  },
} as const;

export type WebTranslationKey = keyof typeof WEB_TRANSLATIONS.es;

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: WebTranslationKey | string) => string;
  isSpanish: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  t: (key) => key,
  isSpanish: true,
  isEnglish: false,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'es') return saved;
    } catch {
      // ignore
    }
    return 'es';
  });

  const setLanguage = (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  };

  const t = (key: WebTranslationKey | string): string => {
    const currentDict = WEB_TRANSLATIONS[language] as Record<string, string>;
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    const fallbackDict = WEB_TRANSLATIONS.es as Record<string, string>;
    if (fallbackDict[key]) {
      return fallbackDict[key];
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
