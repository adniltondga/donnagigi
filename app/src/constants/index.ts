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
      LOGOUT: '/api/auth/logout',
      REGISTER: '/api/auth/register',
      VERIFY_EMAIL: '/api/auth/verify-email',
      RESEND_VERIFICATION: '/api/auth/resend-verification',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
      ME: '/api/auth/me',
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
    RELATORIOS: {
      V2: '/api/relatorios/v2',
    },
    WAITLIST: '/api/waitlist',
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

// Paleta espelha a do web (tailwind.config.ts + globals.css):
// primary = roxo (violet 700), neutros = slate, dark = hsl(222 30% 7%).
// COLORS é só o fallback estático — telas devem ler de useTheme().colors.
export const COLORS = {
  primary: '#6d28d9',
  primaryDark: '#5b21b6',
  primaryLight: '#8b5cf6',

  background: '#0a0f1c',
  backgroundLight: '#0f172a',
  backgroundCard: '#1e293b',

  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',

  border: '#334155',
  borderLight: '#1e293b',

  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#8b5cf6',

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
