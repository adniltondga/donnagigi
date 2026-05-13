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

const darkColors: ThemeColors = {
  primary: '#0A84FF',
  primaryDark: '#0071E3',
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
};

const lightColors: ThemeColors = {
  primary: '#007AFF',
  primaryDark: '#0056B3',
  primaryLight: '#409CFF',
  background: '#F2F2F7',
  backgroundLight: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textMuted: '#8E8E93',
  border: '#C6C6C8',
  borderLight: '#E5E5EA',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FFCC00',
  info: '#007AFF',
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
