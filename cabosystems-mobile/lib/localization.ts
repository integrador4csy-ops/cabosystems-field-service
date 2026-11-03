import { UI_TRANSLATIONS } from './uiTranslations';

export type SupportedLanguage = 'es' | 'en';
export type TranslationParams = Record<string, string | number | null | undefined>;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
let currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

export function setCurrentLanguage(language: SupportedLanguage) { currentLanguage = language; }
export function getCurrentLanguage() { return currentLanguage; }
export function getLocale(language: SupportedLanguage = currentLanguage) { return language === 'en' ? 'en-US' : 'es-MX'; }

export function translateText(language: SupportedLanguage, key: string, params?: TranslationParams): string {
  const trimmed = key.trim();
  if (!trimmed) return key;
  const translated = language === 'en' ? UI_TRANSLATIONS[trimmed] ?? trimmed : trimmed;
  const text = key.slice(0, key.length - key.trimStart().length) + translated + key.slice(key.trimEnd().length);
  // Insert values once: user content containing braces must never become a template.
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(params, name) ? String(params[name] ?? '') : match) : text;
}

/** For native prompts and service errors raised outside a React component. */
export function translateCurrent(key: string, params?: TranslationParams) { return translateText(currentLanguage, key, params); }

const ROLE_IDS = new Set(['admin', 'supervisor_instalacion', 'instalador', 'aux_instalacion', 'integrador', 'aux_integracion', 'infraestructura', 'aux_infraestructura', 'servicios', 'aux_servicios', 'aux_operaciones', 'supervisor', 'tecnico']);
export function getRoleLabel(role: string | null | undefined, t: (key: string) => string) {
  return role && ROLE_IDS.has(role) ? t(`role.${role}`) : role ? role.replace(/_/g, ' ') : t('Técnico');
}
