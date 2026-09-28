// PALETA ESTRICTA — Solo 4 colores:
//   negro (#000000 + alphas) · blanco (#ffffff + alphas)
//   #343e48 (gris pizarra) · #f78c26 (naranja CSY)
//
// LIGHT THEME — minimalista, limpio, con animaciones suaves
export const Colors = {
  primary: '#f78c26',
  primaryLight: 'rgba(247, 140, 38, 0.10)',
  primaryMedium: 'rgba(247, 140, 38, 0.20)',

  background: '#FFFFFF',
  backgroundAlt: '#F7F7F8',
  backgroundDark: '#F0F0F2',
  backgroundGray: '#ECECEF',
  card: '#FFFFFF',
  surface: '#FFFFFF',

  text: '#343e48',
  textSecondary: '#343e48',
  textMuted: 'rgba(52, 62, 72, 0.50)',

  border: 'rgba(52, 62, 72, 0.12)',
  borderLight: 'rgba(52, 62, 72, 0.06)',
  borderHover: 'rgba(52, 62, 72, 0.22)',
  borderDark: '#343e48',

  pending: '#343e48',
  inProgress: '#f78c26',
  completed: '#000000',

  textWhite: '#FFFFFF',
  success: '#000000',
  warning: '#f78c26',
  error: '#f78c26',
};

export const Glass = {
  bg: 'rgba(255, 255, 255, 0.72)',
  bgSolid: '#FFFFFF',
  border: 'rgba(52, 62, 72, 0.08)',
  borderHover: 'rgba(52, 62, 72, 0.15)',
  blurTint: 'light' as const,
  blurIntensity: 60,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

// Animaciones — press, spring, fade
export const Animation = {
  pressScale: 0.97,
  pressOpacity: 0.8,
  durationFast: 120,
  durationNormal: 200,
  spring: { damping: 18, stiffness: 280, mass: 0.8 },
  springSnappy: { damping: 22, stiffness: 350, mass: 0.6 },
  fadeIn: { duration: 180 },
  slideUp: { duration: 220 },
};

// Sombras con tono pizarra para integrar con la marca
export const Shadow = {
  sm: {
    shadowColor: '#343e48',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#343e48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#343e48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 6,
  },
  primary: {
    shadowColor: '#f78c26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const Typography = {
  h1: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    color: Colors.text,
  },
  h2: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  h3: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.text,
  },
  body: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.text,
  },
  bodyBold: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  caption: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
};
