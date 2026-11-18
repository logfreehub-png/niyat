import { PRAYERS, type PrayerKey } from '../constants';
import { isoDate } from '../date';
import { computeTimes, nextPrayer } from '../prayerTimes';
import { getApiUrl } from '../api';
import { secure, storage } from '../storage';

/**
 * Vidjetlar uchun ma'lumot. Vidjet ilova yopiq paytda (headless JS) chizilgani uchun
 * hamma narsa telefon xotirasidan o'qiladi: namoz vaqtlari joyida hisoblanadi,
 * namoz/zikr holati esa ilova saqlab qo'ygan keshdan (imkon bo'lsa serverdan yangilanadi).
 */

const FALLBACK = { latitude: 41.2995, longitude: 69.2401 }; // Toshkent
const CACHE_KEY = 'widgetSummary';

export type WidgetSummary = {
  date: string;
  prayers: Record<PrayerKey, boolean>;
  adhkar_progress: number;
  affirmation: string;
  /** "Kunlik reja va majburiyatlar" matni (har qatorda bitta ish; bajarilgani "✓ " bilan boshlanadi) */
  plans?: string;
  /** Bugungi zikr va salovatlar (vidjet uchun ixcham) */
  zikrs?: WidgetZikr[];
};

export type WidgetZikr = { title: string; count: number; target: number };

export type PlanItem = { index: number; text: string; done: boolean };

const DONE_RE = /^\s*(✓|✔|✅|\[x\])\s*/i;
const NUM_RE = /^\s*(\d+[.)]|[-•*])\s+/;

/** Reja matnini qatorlarga ajratadi. `index` — asl matndagi qator raqami (belgilash uchun). */
export function parsePlans(text: string | undefined): PlanItem[] {
  return (text ?? '')
    .split('\n')
    .map((line, index) => {
      const done = DONE_RE.test(line);
      const clean = line.replace(DONE_RE, '').replace(NUM_RE, '').trim();
      return { index, text: clean, done };
    })
    .filter((p) => p.text.length > 0);
}

/** Bitta qatorni bajarildi/bajarilmadi qiladi ("✓ " belgisi). */
export function togglePlanLine(text: string, index: number): string {
  const lines = text.split('\n');
  const line = lines[index];
  if (line === undefined) return text;
  lines[index] = DONE_RE.test(line) ? line.replace(DONE_RE, '') : `✓ ${line.trimStart()}`;
  return lines.join('\n');
}

export type WidgetData = {
  loggedIn: boolean;
  today: string;
  times: { key: PrayerKey; label: string; time: Date; done: boolean }[];
  next: { key: PrayerKey; label: string; time: Date };
  prayersDone: number;
  adhkarProgress: number;
  affirmation: string;
  plans: PlanItem[];
  zikrs: WidgetZikr[];
  themeMode: 'system' | 'light' | 'dark';
};

const emptyPrayers = (): Record<PrayerKey, boolean> =>
  Object.fromEntries(PRAYERS.map((p) => [p.key, false])) as Record<PrayerKey, boolean>;

async function readCache(): Promise<WidgetSummary | null> {
  try {
    const raw = await storage.get(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WidgetSummary) : null;
  } catch {
    return null;
  }
}

/** Ilova ichidan chaqiriladi: bugungi holatni vidjet uchun saqlaydi. */
export async function saveWidgetSummary(s: WidgetSummary) {
  const prev = await readCache();
  // Bugun affirmatsiya yozilmagan bo'lsa — oxirgi yozilganini qoldiramiz (server ham shunday qiladi)
  const affirmation = s.affirmation.trim() || prev?.affirmation || '';
  await storage.set(CACHE_KEY, JSON.stringify({ ...s, affirmation }));
}

export async function clearWidgetSummary() {
  await storage.remove(CACHE_KEY);
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await secure.get('token');
  if (!token) return null;
  const base = getApiUrl();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(base + path, {
      ...init,
      signal: ctrl.signal,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Serverdan bugungi ixcham ma'lumotni olib keshni yangilaydi (internet bo'lmasa — jim o'tadi). */
export async function refreshFromServer(): Promise<void> {
  const today = isoDate();
  const res = await authFetch(`/summary/${today}`);
  if (!res) return;
  try {
    const body = await res.json();
    const prev = await readCache();
    const prevZikrs = (prev?.zikrs ?? []).map((z) => (prev?.date === today ? z : { ...z, count: 0 }));
    await storage.set(
      CACHE_KEY,
      JSON.stringify({
        date: today,
        prayers: { ...emptyPrayers(), ...body.prayers },
        adhkar_progress: body.adhkar_progress ?? 0,
        affirmation: body.affirmation ?? '',
        plans: body.daily_plans ?? '',
        // Eski server zikrlarni qaytarmaydi — u holda ilova saqlagan ro'yxat qoladi
        zikrs: Array.isArray(body.zikrs) ? body.zikrs : prevZikrs,
      } satisfies WidgetSummary),
    );
  } catch {}
}

/** Vidjetdan namozni belgilash: keshni darhol yangilaydi, keyin serverga yuboradi. */
export async function togglePrayerFromWidget(key: PrayerKey): Promise<void> {
  const today = isoDate();
  const prev = await readCache();
  const base: WidgetSummary =
    prev && prev.date === today ? prev : { date: today, prayers: emptyPrayers(), adhkar_progress: 0, affirmation: prev?.affirmation ?? '' };
  const value = !base.prayers[key];
  await storage.set(CACHE_KEY, JSON.stringify({ ...base, prayers: { ...base.prayers, [key]: value } }));
  await authFetch(`/days/${today}/prayers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: value }),
  });
}

/** Vidjetdan reja qatorini belgilash: keshni darhol yangilaydi, keyin serverga yuboradi. */
export async function togglePlanFromWidget(index: number): Promise<void> {
  const today = isoDate();
  const prev = await readCache();
  if (!prev || prev.date !== today) return;
  const plans = togglePlanLine(prev.plans ?? '', index);
  await storage.set(CACHE_KEY, JSON.stringify({ ...prev, plans }));
  await authFetch(`/days/${today}/log`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_plans: plans }),
  });
}

export async function loadWidgetData(now = new Date()): Promise<WidgetData> {
  const today = isoDate(now);
  let coords = FALLBACK;
  try {
    const saved = await storage.get('coords');
    if (saved) coords = JSON.parse(saved);
  } catch {}

  const [token, cache, mode] = await Promise.all([
    secure.get('token').catch(() => null),
    readCache(),
    storage.get('themeMode').catch(() => null),
  ]);
  const fresh = cache && cache.date === today ? cache : null;
  const prayers = fresh?.prayers ?? emptyPrayers();

  const t = computeTimes(now, coords);
  const next = nextPrayer(t, coords, now);

  return {
    loggedIn: !!token,
    today,
    times: PRAYERS.map((p) => ({ key: p.key, label: p.label, time: t[p.key], done: !!prayers[p.key] })),
    next: { key: next.key, label: next.label, time: next.time },
    prayersDone: PRAYERS.filter((p) => prayers[p.key]).length,
    adhkarProgress: fresh?.adhkar_progress ?? 0,
    affirmation: cache?.affirmation ?? '',
    plans: parsePlans(fresh?.plans),
    zikrs: fresh?.zikrs ?? (cache?.zikrs ?? []).map((z) => ({ ...z, count: 0 })),
    themeMode: mode === 'light' || mode === 'dark' ? mode : 'system',
  };
}
