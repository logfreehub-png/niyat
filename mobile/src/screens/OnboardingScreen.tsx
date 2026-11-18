import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { JournalArt, PrayersArt, TasbehArt, WelcomeArt } from '../components/OnboardingArt';
import { Button } from '../components/ui';
import { useTheme } from '../theme';

type Slide = {
  key: string;
  Art: React.ComponentType<{ dark: boolean }>;
  badge: IconName;
  kicker: string;
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    Art: WelcomeArt,
    badge: 'star-crescent',
    kicker: 'Xush kelibsiz',
    title: 'Niyat — ma\'naviy kundaligingiz',
    text: 'Har kuni ibodat, zikr va o\'z ustingizda ishlashni bir joyda kuzating. Kichik odatlar — katta o\'zgarishlar.',
  },
  {
    key: 'prayers',
    Art: PrayersArt,
    badge: 'mosque',
    kicker: '5 vaqt namoz',
    title: 'Namozlaringizni belgilang',
    text: 'Namoz vaqtlari joylashuvingiz bo\'yicha hisoblanadi. Navbatdagi namozgacha qolgan vaqtni ko\'rib turasiz.',
  },
  {
    key: 'tasbeh',
    Art: TasbehArt,
    badge: 'gesture-tap',
    kicker: 'Elektron tasbeh',
    title: 'Zikr va salovatlar',
    text: 'Ekranning istalgan joyiga bosing — har bosishda yengil tebranish. Maqsadga yetganda tasbeh o\'zi to\'xtaydi.',
  },
  {
    key: 'journal',
    Art: JournalArt,
    badge: 'hands-pray',
    kicker: 'Duo va kechki xulosa',
    title: 'Kuningizni yakunlang',
    text: 'Zikrlardan so\'ng duo qiling, shukronalar va rejalarni yozing. Kechqurun kuningizni 1–10 ball bilan baholang.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, 560);
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [pageH, setPageH] = useState(0);
  const last = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    setIndex(i);
    ref.current?.scrollTo({ x: i * width, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={[s.wrap, { width }]}>
        <View style={s.top}>
          <View style={s.brand}>
            <View style={[s.brandDot, { backgroundColor: colors.primary }]}>
              <Icon name="star-crescent" size={14} color={colors.primaryText} />
            </View>
            <Text style={[s.brandText, { color: colors.text }]}>Niyat</Text>
          </View>
          {!last && (
            <Pressable onPress={onDone} hitSlop={12}>
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 15 }}>O'tkazib yuborish</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={{ flex: 1 }}
          onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
        >
          {SLIDES.map(({ key, Art, badge, kicker, title, text }) => (
            <View key={key} style={[s.slide, { width }, pageH > 0 && { height: pageH }]}>
              <View style={[s.artCard, { borderColor: colors.border }]}>
                <Art dark={isDark} />
              </View>
              <View style={[s.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name={badge} size={26} color={colors.primary} />
              </View>
              <Text style={[s.kicker, { color: colors.primary }]}>{kicker.toUpperCase()}</Text>
              <Text style={[s.title, { color: colors.text }]}>{title}</Text>
              <Text style={[s.text, { color: colors.textMuted }]}>{text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <View style={s.dots}>
            {SLIDES.map((sl, i) => (
              <Pressable key={sl.key} onPress={() => goTo(i)} hitSlop={8}>
                <View
                  style={[
                    s.dot,
                    { backgroundColor: i === index ? colors.primary : colors.border },
                    i === index && { width: 26 },
                  ]}
                />
              </Pressable>
            ))}
          </View>
          <Button
            title={last ? 'Boshlash' : 'Keyingi'}
            icon={last ? 'check' : 'arrow-right'}
            onPress={() => (last ? onDone() : goTo(index + 1))}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  wrap: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '800' },
  slide: { paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  artCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 340,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 14 },
  title: { fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 6, lineHeight: 31 },
  text: { fontSize: 15.5, textAlign: 'center', marginTop: 10, lineHeight: 23, paddingHorizontal: 6 },
  footer: { paddingHorizontal: 20, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
