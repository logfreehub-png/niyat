import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { Icon, type IconName } from './src/components/Icon';
import { OverlayHost } from './src/components/Overlay';
import { addDays, isoDate, prettyDate } from './src/date';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ReflectionScreen } from './src/screens/ReflectionScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { storage } from './src/storage';
import { ThemeProvider, useTheme } from './src/theme';
import { useDay } from './src/useDay';
import { updateWidgets } from './src/widgets';
import { saveWidgetSummary } from './src/widgets/data';
import { initPrayerNotifications, reschedulePrayerNotifications } from './src/notifications';

type Tab = 'today' | 'evening' | 'settings';
const TABS: { key: Tab; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'today', label: 'Bugun', icon: 'white-balance-sunny', iconActive: 'white-balance-sunny' },
  { key: 'evening', label: 'Kechki xulosa', icon: 'weather-night', iconActive: 'weather-night' },
  { key: 'settings', label: 'Sozlamalar', icon: 'cog-outline', iconActive: 'cog' },
];

function Main() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(isoDate());
  const dayState = useDay(date);
  const today = isoDate();

  // Ilova ertasi kuni ochilsa — avtomatik bugungi sanaga o'tish
  useEffect(() => {
    let last = isoDate();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && isoDate() !== last) {
        last = isoDate();
        setDate(last);
      }
    });
    return () => sub.remove();
  }, []);

  // Namoz vaqti bildirishnomalari: ishga tushganda va ilovaga qaytganda (kun o'tgan bo'lsa) yangilanadi
  useEffect(() => {
    initPrayerNotifications();
    let lastDay = isoDate();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && isoDate() !== lastDay) {
        lastDay = isoDate();
        reschedulePrayerNotifications().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Vidjetdan namoz belgilangan bo'lishi mumkin — ilovaga qaytganda bugungi kunni qayta yuklaymiz
  const reloadRef = useRef(dayState.reload);
  reloadRef.current = dayState.reload;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reloadRef.current();
    });
    return () => sub.remove();
  }, []);

  // Bugungi holat o'zgarsa — uy ekranidagi vidjetlarni yangilaymiz
  const d = dayState.day;
  const syncKey =
    d && d.date === isoDate()
      ? JSON.stringify([d.date, d.prayers, d.adhkar_progress, d.log.affirmation, d.log.daily_plans, d.zikrs.map((z) => [z.title, z.count, z.target])])
      : null;
  useEffect(() => {
    if (!d || !syncKey) return;
    const t = setTimeout(() => {
      saveWidgetSummary({
        date: d.date,
        prayers: d.prayers,
        adhkar_progress: d.adhkar_progress,
        affirmation: d.log.affirmation,
        plans: d.log.daily_plans,
        zikrs: d.zikrs.map((z) => ({ title: z.title, count: z.count, target: z.target })),
      })
        .then(() => updateWidgets())
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {tab !== 'settings' && (
        <View style={[s.header, { borderColor: colors.border }]}>
          <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={12}>
            <Icon name="chevron-left" size={30} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => setDate(today)} style={{ alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>
              {date === today ? 'Bugun' : date === addDays(today, -1) ? 'Kecha' : prettyDate(date).split(', ')[0]}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 1 }}>
              {date === today ? prettyDate(date) : prettyDate(date).split(', ')[1]}
            </Text>
          </Pressable>
          <Pressable onPress={() => date < today && setDate(addDays(date, 1))} hitSlop={12} disabled={date >= today}>
            <View style={{ opacity: date < today ? 1 : 0.25 }}>
              <Icon name="chevron-right" size={30} color={colors.primary} />
            </View>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayScreen date={date} state={dayState} />}
        {tab === 'evening' && <ReflectionScreen date={date} state={dayState} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <View style={[s.tabbar, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 6 }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={s.tab}>
              <View style={[s.tabIcon, active && { backgroundColor: colors.primarySoft }]}>
                <Icon name={active ? t.iconActive : t.icon} size={22} color={active ? colors.primary : colors.textMuted} />
              </View>
              <Text style={{ fontSize: 12, marginTop: 2, color: active ? colors.primary : colors.textMuted, fontWeight: active ? '700' : '500' }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Root() {
  const { colors, isDark } = useTheme();
  const { user, ready } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage
      .get('onboarded')
      .then((v) => setOnboarded(v === '1'))
      .catch(() => setOnboarded(true));
  }, []);

  const finishOnboarding = () => {
    setOnboarded(true);
    storage.set('onboarded', '1').catch(() => {});
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!ready || onboarded === null ? (
        <View style={[s.root, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : user ? (
        <Main />
      ) : !onboarded ? (
        <OnboardingScreen onDone={finishOnboarding} />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <OverlayHost>
            <Root />
          </OverlayHost>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center' },
});
