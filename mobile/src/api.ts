import { Platform } from 'react-native';
import type { AdhkarKey, PrayerKey } from './constants';
import { storage } from './storage';

// Android emulyatori uchun 10.0.2.2 = kompyuterning localhost'i.
// Haqiqiy telefonda Sozlamalar bo'limidan kompyuter IP manzilini kiriting.
const PROD_URL = 'http://195.158.16.125:3050';
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (!__DEV__ ? PROD_URL : Platform.OS === 'android' ? 'http://10.0.2.2:8001' : 'http://localhost:8001');

let baseUrl = DEFAULT_URL;
let token: string | null = null;
let onUnauthorized: () => void = () => {};

/** Server manzili foydalanuvchiga ko'rsatilmaydi: faqat build sozlamasidan (EXPO_PUBLIC_API_URL) olinadi. */
export async function loadApiUrl() {
  // Eski versiyalarda qo'lda kiritilgan manzil qolib ketgan bo'lsa — tozalaymiz
  await storage.remove('apiUrl').catch(() => {});
  baseUrl = DEFAULT_URL;
  return baseUrl;
}
export const getApiUrl = () => baseUrl;
export const setToken = (t: string | null) => (token = t);
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(baseUrl + path, { ...init, headers });
  } catch {
    throw new ApiError(0, "Serverga ulanib bo'lmadi. Internet yoki server manzilini tekshiring.");
  }
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    let msg = `Xatolik (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') msg = body.detail;
      else if (Array.isArray(body.detail)) msg = "Ma'lumot noto'g'ri kiritildi";
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

async function requestNoBody(path: string, init: RequestInit = {}): Promise<void> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(baseUrl + path, { ...init, headers });
  } catch {
    throw new ApiError(0, "Serverga ulanib bo'lmadi. Internet yoki server manzilini tekshiring.");
  }
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, `Xatolik (${res.status})`);
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ---- Turlar ----
export type User = { id: number; phone: string; name?: string; avatar?: string };
export type TokenResp = { access_token: string; user: User };
export type PhoneStart = { token: string; phone: string; bot_url: string; expires_in: number };
export type Forgot = PhoneStart & { code_sent: boolean };
export type DailyLog = { gratitudes: string; affirmation: string; daily_plans: string };
export type Prayers = Record<PrayerKey, boolean>;
export type Adhkar = Record<AdhkarKey, number> & { duo_completed: boolean; duo_text: string };
export type Reflection = {
  feel_today: string;
  good_deeds: string;
  mistakes_to_fix: string;
  overall_score: number | null;
};
export type Zikr = {
  id: number;
  title: string;
  arabic: string;
  text: string;
  icon: string;
  target: number;
  is_custom: boolean;
  edited: boolean;
  legacy_key: string | null;
};
export type DayZikr = Zikr & { count: number };
export type ZikrInput = { title: string; arabic?: string; text?: string; icon?: string; target: number };

export type Day = {
  date: string;
  log: DailyLog;
  prayers: Prayers;
  adhkar: Adhkar;
  reflection: Reflection;
  adhkar_targets: Record<AdhkarKey, number>;
  adhkar_progress: number;
  adhkar_all_done: boolean;
  /** Yangi serverda bor; eski serverda bo'lmasa ilova ADHKAR ro'yxatidan yasaydi. */
  zikrs: DayZikr[];
  /** Server zikrlar API'sini qo'llab-quvvatlaydimi */
  zikrsSupported?: boolean;
};
export type HistoryItem = { date: string; prayers_done: number; adhkar_progress: number; overall_score: number | null };

// ---- Endpointlar ----
export const api = {
  phoneStart: (phone: string) => request<PhoneStart>('/auth/phone/start', json('POST', { phone })),
  register: (token: string, code: string, password: string) =>
    request<TokenResp>('/auth/register', json('POST', { token, code, password })),
  forgotPassword: (phone: string) => request<Forgot>('/auth/password/forgot', json('POST', { phone })),
  resetPassword: (token: string, code: string, password: string) =>
    request<TokenResp>('/auth/password/reset', json('POST', { token, code, password })),
  login: (phone: string, password: string) =>
    request<TokenResp>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`,
    }),
  me: () => request<User>('/auth/me'),
  updateProfile: (data: { name?: string; avatar?: string }) => request<User>('/auth/me', json('PATCH', data)),

  getDay: (date: string) => request<Day>(`/days/${date}`),
  putLog: (date: string, data: Partial<DailyLog>) => request<Day>(`/days/${date}/log`, json('PUT', data)),
  putPrayers: (date: string, data: Partial<Prayers>) => request<Day>(`/days/${date}/prayers`, json('PUT', data)),
  putAdhkar: (date: string, data: Partial<Adhkar>) => request<Day>(`/days/${date}/adhkar`, json('PUT', data)),
  putReflection: (date: string, data: Partial<Reflection>) =>
    request<Day>(`/days/${date}/reflection`, json('PUT', data)),
  history: (end: string, days = 7) => request<HistoryItem[]>(`/history?end=${end}&days=${days}`),

  putZikrCounts: (date: string, counts: Record<number, number>) =>
    request<Day>(`/days/${date}/zikrs`, json('PUT', { counts })),
  createZikr: (data: ZikrInput) => request<Zikr>('/zikrs', json('POST', data)),
  updateZikr: (id: number, data: Partial<ZikrInput>) => request<Zikr>(`/zikrs/${id}`, json('PATCH', data)),
  deleteZikr: (id: number) => requestNoBody(`/zikrs/${id}`, { method: 'DELETE' }),
  resetZikr: (id: number) => request<Zikr>(`/zikrs/${id}/reset`, { method: 'POST' }),
  restoreHiddenZikrs: () => request<Zikr[]>('/zikrs/restore-hidden', { method: 'POST' }),
};
