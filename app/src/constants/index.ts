import Constants from 'expo-constants';

// Em dev: usa o IP do host do Metro (mesma rede do celular), evitando
// precisar atualizar o .env cada vez que o WiFi muda. Fallback: EXPO_PUBLIC_API_URL.
function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
      .expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;

  return 'http://localhost:3000';
}

export const API_CONFIG = {
  BASE_URL: resolveBaseUrl(),
  TIMEOUT: 30000,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      VERIFY_EMAIL: '/api/auth/verify-email',
      RESEND_VERIFICATION: '/api/auth/resend-verification',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
    },
    BILLS: {
      LIST: '/api/bills',
      PAY: (id: string) => `/api/bills/${id}/pay`,
      DETAIL: (id: string) => `/api/bills/${id}`,
    },
    FINANCEIRO: {
      CASH_POOLS: '/api/financeiro/cash-pools',
    },
    NOTIFICATIONS: {
      LIST: '/api/notifications',
      READ_ALL: '/api/notifications/read-all',
      READ_ONE: (id: string) => `/api/notifications/${id}/read`,
    },
    PUSH: {
      EXPO_SUBSCRIBE: '/api/push/expo/subscribe',
      EXPO_UNSUBSCRIBE: '/api/push/expo/unsubscribe',
    },
    PRODUCTS: {
      LIST: '/api/products',
      DETAIL: (id: string) => `/api/products/${id}`,
    },
    ML: {
      TOGGLE_ITEM: (mlListingId: string) =>
        `/api/ml/items/${mlListingId}/toggle`,
    },
  },
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'aglivre_auth_token',
  USER_DATA: 'aglivre_user_data',
  REMEMBER_ME: 'aglivre_remember_me',
  SAVED_EMAIL: 'aglivre_saved_email',
  THEME_MODE: 'aglivre_theme_mode',
  PUSH_TOKEN: 'aglivre_push_token',
  BIOMETRIC_ENABLED: 'aglivre_biometric_enabled',
  BIOMETRIC_PROMPTED: 'aglivre_biometric_prompted',
} as const;

export const COLORS = {
  primary: '#007AFF',
  primaryDark: '#0056B3',
  primaryLight: '#409CFF',

  background: '#000000',
  backgroundLight: '#1C1C1E',
  backgroundCard: '#2C2C2E',

  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#636366',

  border: '#38383A',
  borderLight: '#48484A',

  success: '#30D158',
  error: '#FF453A',
  warning: '#FFD60A',
  info: '#0A84FF',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  shadow: '#000000',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
