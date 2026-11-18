import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Telefonning ovoz tugmalarini tasbeh tugmasi sifatida ishlatish (Android).
 *
 * Tizimning ovoz paneli yashiriladi. Har bosishda musiqa ovozi bir pog'ona o'zgaradi —
 * shu o'zgarish yo'nalishiga qarab "yuqori"/"past" aniqlanadi. Ovoz chegaraga yaqinlashsa
 * o'rtaga qaytariladi, yopilganda esa foydalanuvchining avvalgi ovozi tiklanadi.
 */
export function useVolumeButtons(active: boolean, onUp: () => void, onDown: () => void) {
  const handlers = useRef({ onUp, onDown });
  handlers.current = { onUp, onDown };

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    let VM: typeof import('react-native-volume-manager').VolumeManager;
    try {
      VM = require('react-native-volume-manager').VolumeManager;
    } catch {
      return; // Expo Go — native modul yo'q
    }

    let original: number | null = null;
    let last: number | null = null;
    // Bitta bosishda ba'zi telefonlar (HONOR, Samsung) bir nechta hodisa yuboradi, o'zimiz ovozni
    // o'rtaga qaytarganda ham hodisa keladi. Shu oynada kelganlarini sanamaymiz.
    let lockUntil = 0;
    const PRESS_GAP_MS = 230;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;

    const center = async () => {
      // O'zimiz qo'ygan qiymat `last`ga yoziladi: shu qiymatdagi hodisa keyin kelsa — e'tiborsiz qoladi
      if (last !== null && Math.abs(last - 0.5) < 0.05) return;
      await VM.setVolume(0.5, { type: 'music', showUI: false, playSound: false }).catch(() => {});
      const v = await VM.getVolume().catch(() => null);
      last = v ? v.volume : 0.5;
    };

    (async () => {
      try {
        await VM.showNativeVolumeUI({ enabled: false });
        const v = await VM.getVolume();
        original = v.volume;
        last = v.volume;
        if (cancelled) return;
        await center();
        sub = VM.addVolumeListener(({ volume, type }) => {
          if (type && type !== 'music') return; // ba'zi telefonlar boshqa oqimlar uchun ham xabar beradi
          const now = Date.now();
          if (now < lockUntil) {
            last = volume; // shu bosishning davomi yoki o'zimiz qilgan o'zgarish
            return;
          }
          if (last === null || Math.abs(volume - last) < 0.001) return;
          if (volume > last) handlers.current.onUp();
          else handlers.current.onDown();
          last = volume;
          lockUntil = now + PRESS_GAP_MS;
          if (volume > 0.8 || volume < 0.2) {
            lockUntil = now + 500;
            center();
          }
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      (async () => {
        if (original !== null) {
          await VM.setVolume(original, { type: 'music', showUI: false, playSound: false }).catch(() => {});
        }
        await VM.showNativeVolumeUI({ enabled: true }).catch(() => {});
      })();
    };
  }, [active]);
}
