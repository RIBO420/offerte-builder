import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, ColorScheme } from './colors';

const THEME_STORAGE_KEY = '@toptuinen_theme_mode';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colors: ColorScheme;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(systemColorScheme);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
          setModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Listen for system appearance changes when in 'system' mode
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Sync systemScheme with the hook value
  useEffect(() => {
    setSystemScheme(systemColorScheme);
  }, [systemColorScheme]);

  // Save theme preference when mode changes
  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const themeColors = isDark ? { ...colors, ...darkColors } : colors;

  // Don't render children until theme is loaded to avoid flash
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ colors: themeColors, isDark, mode, setMode, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useColors() {
  return useTheme().colors;
}
