import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Butun ekranni qoplaydigan qatlam (Modal o'rniga).
 * Modal Android'da alohida oyna ochadi va ovoz tugmalarini ushlab bo'lmaydi;
 * bu qatlam esa asosiy oynada qoladi.
 */
const Ctx = createContext<(node: ReactNode | null) => void>(() => {});

export function OverlayHost({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode | null>(null);
  return (
    <Ctx.Provider value={setNode}>
      <View style={{ flex: 1 }}>
        {children}
        {node ? <View style={StyleSheet.absoluteFill}>{node}</View> : null}
      </View>
    </Ctx.Provider>
  );
}

/** Ichidagini OverlayHost ustida chizadi; komponent yo'qolganda qatlam ham yopiladi. */
export function Overlay({ children }: { children: ReactNode }) {
  const set = useContext(Ctx);
  useEffect(() => {
    set(children);
  }, [children, set]);
  useEffect(() => () => set(null), [set]);
  return null;
}
