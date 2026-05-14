import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { secureStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  backgroundLight: string;
  backgroundCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  white: string;
  black: string;
  transparent: string;
  shadow: string;
}

// Paleta espelha a da web (tailwind.config.ts + src/app/globals.css).
// primary = violet-700, neutros = slate; dark ~ hsl(222 30% 7%).
const darkColors: ThemeColors = {
  primary: '#8b5cf6',      // violet-500 (mais claro pra contraste no dark, como --ring dark da web)
  primaryDark: '#6d28d9',  // violet-700
  primaryLight: '#a78bfa', // violet-400
  background: '#0a0f1c',   // ~ hsl(222 30% 7%)
  backgroundLight: '#0f172a', // slate-900 (card)
  backgroundCard: '#1e293b',  // slate-800 (muted)
  textPrimary: '#f1f5f9',  // slate-100
  textSecondary: '#cbd5e1', // slate-300
  textMuted: '#94a3b8',    // slate-400
  border: '#334155',       // slate-700
  borderLight: '#1e293b',  // slate-800
  success: '#22c55e',      // green-500
  error: '#ef4444',        // red-500
  warning: '#f59e0b',      // amber-500
  info: '#8b5cf6',         // violet-500
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  shadow: '#000000',
};

const lightColors: ThemeColors = {
  primary: '#6d28d9',      // violet-700
  primaryDark: '#5b21b6',  // violet-800
  primaryLight: '#8b5cf6', // violet-500
  background: '#f8fafc',   // slate-50 (--app-bg da web)
  backgroundLight: '#ffffff',
  backgroundCard: '#ffffff',
  textPrimary: '#0f172a',  // slate-900
  textSecondary: '#475569', // slate-600
  textMuted: '#64748b',    // slate-500
  border: '#e2e8f0',       // slate-200
  borderLight: '#f1f5f9',  // slate-100
  success: '#16a34a',      // green-600
  error: '#dc2626',        // red-600
  warning: '#f59e0b',      // amber-500
  info: '#6d28d9',         // violet-700
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  shadow: '#000000',
};

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    secureStorage.getItem(STORAGE_KEYS.THEME_MODE).then((saved) => {
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        setModeState(saved as ThemeMode);
      }
    });
  }, []);

  const isDark =
    mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    await secureStorage.setItem(STORAGE_KEYS.THEME_MODE, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export type { ThemeColors, ThemeMode };
