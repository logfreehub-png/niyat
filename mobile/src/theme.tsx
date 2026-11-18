import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const light = {
  bg: '#F7F1E3', // och krem
  surface: '#FFFBF2',
  surfaceAlt: '#EFE6D2',
  text: '#1F2A24',
  textMuted: '#6B6A5E',
  border: '#E3D8C0',
  primary: '#0F7B5F', // zumrad yashil
  primaryText: '#FFFFFF',
  primarySoft: '#D6EDE4',
  danger: '#B4443A',
  hero: '#0F7B5F', // asosiy karta foni
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.75)',
  heroTrack: 'rgba(255,255,255,0.22)',
};

const dark: typeof light = {
  bg: '#0F1B2D', // yumshoq to'q ko'k
  surface: '#16263D',
  surfaceAlt: '#1E3250',
  text: '#E6EDF5',
  textMuted: '#93A3B8',
  border: '#263D5E',
  primary: '#2BB38A',
  primaryText: '#06231A',
  primarySoft: '#173F3A',
  danger: '#E07A70',
  hero: '#14473F',
  heroText: '#E6EDF5',
  heroMuted: '#A9C7BE',
  heroTrack: 'rgba(255,255,255,0.14)',
};

export type Colors = typeof light;

type ThemeCtx = { colors: Colors; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void };
const Ctx = createContext<ThemeCtx>({ colors: light, isDark: false, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    storage.get('themeMode').then((m) => m && setModeState(m as ThemeMode));
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.set('themeMode', m);
  };

  const value = useMemo(() => {
    const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return { colors: isDark ? dark : light, isDark, mode, setMode };
  }, [mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
