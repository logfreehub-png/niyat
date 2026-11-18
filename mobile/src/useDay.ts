import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Adhkar, type DailyLog, type Day, type DayZikr, type Prayers, type Reflection } from './api';
import { ADHKAR, type PrayerKey } from './constants';

/** Har bir zikrning bajarilish ulushi o'rtachasi (0..100). */
export function zikrProgress(zikrs: DayZikr[]): number {
  const list = zikrs.filter((z) => z.target > 0);
  if (!list.length) return 0;
  const sum = list.reduce((s, z) => s + Math.min(z.count, z.target) / z.target, 0);
  return Math.round((100 * sum) / list.length);
}

/**
 * Eski server (zikrlar API'sisiz) javob bersa — zikrlarni ADHKAR ro'yxati va eski sanoqlardan yasaymiz.
 * Shunda ilova server yangilanishidan oldin ham ishlaydi.
 */
function normalize(d: Day): Day {
  if (Array.isArray(d.zikrs)) return { ...d, zikrsSupported: true };
  const zikrs: DayZikr[] = ADHKAR.map((z, i) => ({
    id: -(i + 1),
    title: z.label,
    arabic: z.arabic,
    text: '',
    icon: z.icon,
    target: d.adhkar_targets?.[z.key] ?? z.target,
    is_custom: false,
    edited: false,
    legacy_key: z.key,
    count: d.adhkar?.[z.key] ?? 0,
  }));
  return { ...d, zikrs, zikrsSupported: false };
}

/** Bir kunlik ma'lumotni yuklaydi va optimistik tarzda yangilaydi. */
export function useDay(date: string) {
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingAdhkar = useRef<Partial<Adhkar>>({});
  const pendingCounts = useRef<Record<number, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayRef = useRef<Day | null>(null);
  dayRef.current = day;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setDay(normalize(await api.getDay(date)));
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    load();
  }, [load]);

  const patch = (fn: (d: Day) => Day) => setDay((d) => (d ? fn(d) : d));

  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const flushAdhkar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const adhkar = pendingAdhkar.current;
    const counts = pendingCounts.current;
    pendingAdhkar.current = {};
    pendingCounts.current = {};
    const jobs: Promise<unknown>[] = [];
    if (Object.keys(counts).length) jobs.push(api.putZikrCounts(date, counts));
    if (Object.keys(adhkar).length) jobs.push(api.putAdhkar(date, adhkar));
    if (jobs.length) await run(Promise.all(jobs));
  }, [date]);

  useEffect(() => () => void flushAdhkar(), [flushAdhkar]);

  const schedule = (immediate: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    if (immediate) flushAdhkar();
    else timer.current = setTimeout(flushAdhkar, 800);
  };

  const withProgress = (d: Day, zikrs: DayZikr[]): Day => {
    const progress = zikrProgress(zikrs);
    return { ...d, zikrs, adhkar_progress: progress, adhkar_all_done: progress === 100 };
  };

  const updateAdhkar = (data: Partial<Adhkar>, immediate = false) => {
    patch((d) => ({ ...d, adhkar: { ...d.adhkar, ...data } }));
    pendingAdhkar.current = { ...pendingAdhkar.current, ...data };
    schedule(immediate);
  };

  const setZikrCount = (id: number, count: number) => {
    const d = dayRef.current;
    const z = d?.zikrs.find((x) => x.id === id);
    if (!d || !z) return;
    const value = Math.max(0, Math.min(count, z.target));
    patch((cur) => withProgress(cur, cur.zikrs.map((x) => (x.id === id ? { ...x, count: value } : x))));
    if (d.zikrsSupported) pendingCounts.current = { ...pendingCounts.current, [id]: value };
    else if (z.legacy_key) pendingAdhkar.current = { ...pendingAdhkar.current, [z.legacy_key]: value };
    schedule(false);
  };

  return {
    day,
    error,
    loading,
    reload: () => load(),
    /** Zikr qo'shilgan/tahrirlangandan keyin — spinner ko'rsatmasdan qayta yuklash */
    refresh: async () => {
      await flushAdhkar();
      await load(true);
    },
    togglePrayer: (key: PrayerKey) => {
      if (!day) return;
      const value = !day.prayers[key];
      patch((d) => ({ ...d, prayers: { ...d.prayers, [key]: value } }));
      run(api.putPrayers(date, { [key]: value } as Partial<Prayers>));
    },
    setZikrCount,
    updateAdhkar,
    flushAdhkar,
    saveLog: (data: Partial<DailyLog>) => {
      patch((d) => ({ ...d, log: { ...d.log, ...data } }));
      return run(api.putLog(date, data));
    },
    saveReflection: (data: Partial<Reflection>) => {
      patch((d) => ({ ...d, reflection: { ...d.reflection, ...data } }));
      return run(api.putReflection(date, data));
    },
  };
}
