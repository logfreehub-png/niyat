import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import * as Location from 'expo-location';
import { PRAYERS, type PrayerKey } from './constants';
import { storage } from './storage';

// Joylashuv aniqlanmasa — Toshkent
const FALLBACK = { latitude: 41.2995, longitude: 69.2401 };

export async function getCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
      if (pos) {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        storage.set('coords', JSON.stringify(c));
        return c;
      }
    }
  } catch {}
  const saved = await storage.get('coords');
  return saved ? JSON.parse(saved) : FALLBACK;
}

export type TimesMap = Record<PrayerKey, Date>;

export function computeTimes(date: Date, c: { latitude: number; longitude: number }): TimesMap {
  const params = CalculationMethod.MuslimWorldLeague();
  params.madhab = Madhab.Hanafi; // O'rta Osiyoda hanafiy mazhabi bo'yicha Asr
  const t = new PrayerTimes(new Coordinates(c.latitude, c.longitude), date, params);
  return { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

/** Navbatdagi namoz (bugun hammasi o'tgan bo'lsa — ertangi Bomdod). */
export function nextPrayer(times: TimesMap, coords: { latitude: number; longitude: number }, now = new Date()) {
  for (const p of PRAYERS) {
    if (times[p.key] > now) return { ...p, time: times[p.key] };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return { ...PRAYERS[0], time: computeTimes(tomorrow, coords).fajr };
}
