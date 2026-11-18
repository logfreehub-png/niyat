import { Platform } from 'react-native';
import { PRAYERS, type PrayerKey } from './constants';
import { hhmm } from './date';
import { computeTimes } from './prayerTimes';
import { storage } from './storage';

/**
 * Namoz vaqti bildirishnomalari (mahalliy, internet kerak emas).
 * Telefon joylashuvi bo'yicha keyingi kunlar uchun oldindan rejalashtiriladi va
 * ilova har ochilganda yangilanadi.
 */

const CHANNEL_ID = 'prayer-times';
const DAYS_AHEAD = 7;
const KEY_ENABLED = 'notifyPrayers';
const KEY_PRAYERS = 'notifyPrayerKeys';
const FALLBACK = { latitude: 41.2995, longitude: 69.2401 }; // Toshkent

const MESSAGES: Record<PrayerKey, string> = {
  fajr: 'Bomdod namozi vaqti kirdi',
  dhuhr: 'Peshin namozi vaqti kirdi',
  asr: 'Asr namozi vaqti kirdi',
  maghrib: 'Shom namozi vaqti kirdi',
  isha: 'Xufton namozi vaqti kirdi',
};

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

// Kechiktirib yuklaymiz: web'da modul ishlamaydi
function N(): typeof import('expo-notifications') | null {
  if (!supported) return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

let handlerSet = false;
function ensureHandler() {
  const Notifications = N();
  if (!Notifications || handlerSet) return;
  handlerSet = true;
  // Ilova ochiq bo'lsa ham bildirishnoma ko'rinsin
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  const Notifications = N();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Namoz vaqtlari',
    description: 'Har bir namoz vaqti kirganda eslatma',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 300, 200, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function isEnabled(): Promise<boolean> {
  return (await storage.get(KEY_ENABLED)) !== '0';
}

/** Qaysi namozlar uchun eslatma yoqilgan (standart: hammasi). */
export async function enabledPrayers(): Promise<Record<PrayerKey, boolean>> {
  const all = Object.fromEntries(PRAYERS.map((p) => [p.key, true])) as Record<PrayerKey, boolean>;
  try {
    const raw = await storage.get(KEY_PRAYERS);
    return raw ? { ...all, ...JSON.parse(raw) } : all;
  } catch {
    return all;
  }
}

export async function setPrayerEnabled(key: PrayerKey, value: boolean) {
  const cur = await enabledPrayers();
  await storage.set(KEY_PRAYERS, JSON.stringify({ ...cur, [key]: value }));
  await reschedulePrayerNotifications();
}

/** Ruxsat so'raydi. true — bildirishnoma yuborish mumkin. */
export async function requestPermission(): Promise<boolean> {
  const Notifications = N();
  if (!Notifications) return false;
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function setEnabled(value: boolean): Promise<boolean> {
  await storage.set(KEY_ENABLED, value ? '1' : '0');
  if (!value) {
    await N()?.cancelAllScheduledNotificationsAsync().catch(() => {});
    return true;
  }
  const ok = await requestPermission();
  if (ok) await reschedulePrayerNotifications();
  return ok;
}

let running: Promise<number> | null = null;

/** Keyingi kunlar uchun barcha namoz eslatmalarini qaytadan rejalashtiradi. Rejalashtirilganlar sonini qaytaradi. */
export function reschedulePrayerNotifications(): Promise<number> {
  if (running) return running;
  running = (async () => {
    const Notifications = N();
    if (!Notifications) return 0;
    ensureHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await isEnabled())) return 0;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return 0;
    await ensureChannel();

    let coords = FALLBACK;
    try {
      const saved = await storage.get('coords');
      if (saved) coords = JSON.parse(saved);
    } catch {}
    const which = await enabledPrayers();

    const now = new Date();
    let count = 0;
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
      const times = computeTimes(day, coords);
      for (const p of PRAYERS) {
        const at = times[p.key];
        if (!which[p.key] || at.getTime() <= now.getTime() + 5_000) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🕌 ${MESSAGES[p.key]}`,
            body: `${p.label} — ${hhmm(at)}. Namozni o'z vaqtida o'qing.`,
            sound: 'default',
            data: { type: 'prayer', key: p.key },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
        });
        count++;
      }
    }
    return count;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Sinov uchun: 5 soniyadan keyin bildirishnoma. */
export async function sendTestNotification(): Promise<boolean> {
  const Notifications = N();
  if (!Notifications || !(await requestPermission())) return false;
  ensureHandler();
  await Notifications.scheduleNotificationAsync({
    content: { title: '🕌 Niyat', body: "Namoz vaqti eslatmalari ishlayapti. Alhamdulillah!", sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
  return true;
}

/** Ilova ishga tushganda: birinchi marta ruxsat so'raymiz, keyin rejalashtiramiz. */
export async function initPrayerNotifications(): Promise<void> {
  if (!supported) return;
  try {
    ensureHandler();
    if (!(await isEnabled())) return;
    const asked = await storage.get('notifyAsked');
    if (!asked) {
      await storage.set('notifyAsked', '1');
      await requestPermission();
    }
    await reschedulePrayerNotifications();
  } catch {
    // Expo Go / eski build'da modul bo'lmasa — jim o'tamiz
  }
}
