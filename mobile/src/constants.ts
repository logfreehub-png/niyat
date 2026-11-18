export const PRAYERS = [
  { key: 'fajr', label: 'Bomdod' },
  { key: 'dhuhr', label: 'Peshin' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Shom' },
  { key: 'isha', label: 'Xufton' },
] as const;

export type PrayerKey = (typeof PRAYERS)[number]['key'];

/** Har bir namoz vaqtiga mos ikonka (MaterialCommunityIcons). */
export const PRAYER_ICONS = {
  fajr: 'weather-sunset-up',
  dhuhr: 'white-balance-sunny',
  asr: 'weather-partly-cloudy',
  maghrib: 'weather-sunset-down',
  isha: 'weather-night',
} as const satisfies Record<PrayerKey, string>;

export const ADHKAR = [
  { key: 'salavat_count', label: 'Salovat', arabic: 'اللّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', icon: 'heart-outline', target: 100 },
  { key: 'zikr_count', label: 'Zikr', arabic: 'ذِكْرُ اللّٰهِ', icon: 'star-four-points-outline', target: 1000 },
  { key: 'astagfirulloh_count', label: "Astag'firulloh", arabic: 'أَسْتَغْفِرُ اللّٰهَ', icon: 'water-outline', target: 1000 },
  {
    key: 'la_ilaha_count',
    label: 'Laa ilaaha illallahul malikul haqqul mubiin',
    arabic: 'لَا إِلٰهَ إِلَّا اللّٰهُ الْمَلِكُ الْحَقُّ الْمُبِينُ',
    icon: 'shield-star-outline',
    target: 100,
  },
  { key: 'inshiroh_count', label: 'Alam nashroh (Inshiroh surasi)', arabic: 'سُورَةُ الشَّرْحِ', icon: 'book-open-variant', target: 100 },
  { key: 'waqiah_count', label: 'Voqea surasi', arabic: 'سُورَةُ الْوَاقِعَةِ', icon: 'book-open-page-variant-outline', target: 10 },
] as const;

/** Tasbeh bir davrasidagi donalar soni. */
export const BEADS_PER_ROUND = 33;

export type AdhkarKey = (typeof ADHKAR)[number]['key'];

export const DUO_TEXT = "Ey Robbim, o'zing hohlayotgan narsalarni so'rang va marhamatingdan nasib aylagin";
