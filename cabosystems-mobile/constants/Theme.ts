// CABOSYSTEMS x TAILADMIN DESIGN SYSTEM TOKENS
// Identidad corporativa: Naranja (#f78c26) · Pizarra (#343e48) · Blanco (#FFFFFF)
// Sistema semántico y componentes basados en el estándar oficial de TailAdmin.

export const Colors = {
  // Brand CaboSystems
  primary: '#f78c26',
  primaryDark: '#ea580c',
  primaryLight: '#fff7ed', // brand-50
  primaryMedium: 'rgba(247, 140, 38, 0.15)',
  brandSlate: '#343e48',

  // Canvas & Backgrounds (TailAdmin standards)
  background: '#F9FAFB', // gray-50: fondo moderno de pantalla
  backgroundAlt: '#FFFFFF',
  backgroundDark: '#F2F4F7', // gray-100
  backgroundGray: '#ECECEF',
  card: '#FFFFFF',
  surface: '#FFFFFF',

  // Text Hierarchy (TailAdmin gray scale)
  text: '#1D2939', // gray-800: máxima legibilidad
  textSecondary: '#475467', // gray-600
  textMuted: '#667085', // gray-500
  textDisabled: '#98A2B3', // gray-400
  textWhite: '#FFFFFF',

  // Borders & Dividers
  border: '#E4E7EC', // gray-200: borde nítido oficial TailAdmin
  borderLight: '#F2F4F7', // gray-100
  borderHover: '#D0D5DD', // gray-300
  borderDark: '#343E48',
  borderBrand: '#FED7AA', // brand-200

  // Semantic Colors (TailAdmin light tints & saturated indicators)
  success: '#12B76A',
  successLight: '#ECFDF3', // success-50
  successBorder: '#A6F4C5', // success-200
  successText: '#027A48', // success-700

  warning: '#F79009',
  warningLight: '#FFFAEB', // warning-50
  warningBorder: '#FEDF89', // warning-200
  warningText: '#B54708', // warning-700

  error: '#F04438',
  errorLight: '#FEF3F2', // error-50
  errorBorder: '#FECDCA', // error-200
  errorText: '#B42318', // error-700

  info: '#0BA5EC',
  infoLight: '#F0F9FF', // blue-light-50
  infoBorder: '#B9E6FE', // blue-light-200
  infoText: '#026AA2', // blue-light-700

  // Status mappings para tareas y cuadrillas
  pending: '#475467',
  inProgress: '#F78C26',
  completed: '#12B76A',
};

export const Glass = {
  bg: 'rgba(255, 255, 255, 0.85)',
  bgSolid: '#FFFFFF',
  border: '#E4E7EC',
  borderHover: '#D0D5DD',
  blurTint: 'light' as const,
  blurIntensity: 50,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Radios de esquina oficiales TailAdmin
export const BorderRadius = {
  xs: 6,
  sm: 8, // rounded-lg en Tailwind
  md: 12, // rounded-xl
  lg: 16, // rounded-2xl (tarjetas principales)
  xl: 20,
  '2xl': 24, // rounded-3xl (modales flotantes)
  full: 9999, // rounded-full (badges, avatares y pills)
};

// Animaciones fluidas para micro-interacciones (Vercel React Native Guidelines)
export const Animation = {
  pressScale: 0.98,
  pressOpacity: 0.88,
  durationFast: 120,
  durationNormal: 200,
  spring: { damping: 20, stiffness: 300, mass: 0.8 },
  springSnappy: { damping: 24, stiffness: 380, mass: 0.6 },
  fadeIn: { duration: 180 },
  slideUp: { duration: 220 },
};

// Sombras con sutil tinte neutro (TailAdmin shadow-theme-xs, sm, md, lg)
export const Shadow = {
  xs: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#F78C26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Jerarquía tipográfica con la fuente Outfit oficial
export const Typography = {
  title2xl: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: Colors.text,
  },
  titleXl: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: Colors.text,
  },
  titleLg: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 30,
    color: Colors.text,
  },
  titleMd: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
  },
  titleSm: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
  },
  body: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  bodyMedium: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  bodyBold: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  caption: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  captionMedium: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // Retrocompatibilidad con código existente
  h1: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: Colors.text,
  },
  h2: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 30,
    color: Colors.text,
  },
  h3: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
  },
};
