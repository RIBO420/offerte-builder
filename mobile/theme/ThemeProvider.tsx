import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, lightColors, ColorScheme } from './colors';

// _v2: de vorige sleutel kan 'light' bevatten, gezet door gebruikers die daarmee het
// omgekeerde thema compenseerden. Na de fix zou dat juist het lichte palet geven.
const THEME_STORAGE_KEY = '@toptuinen_theme_mode_v2';

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
  // useColorScheme abonneert zelf al op Appearance-wijzigingen en triggert
  // een re-render; een eigen listener + state-kopie was duplicatie en gaf
  // een setState-in-effect compiler-error.
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);

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

  // Save theme preference when mode changes
  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const isDark = mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
  // `colors` IS het donkere basispalet; licht is de override. Voorheen stond dit om.
  const themeColors = isDark ? colors : { ...colors, ...lightColors };

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
