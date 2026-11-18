import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BEADS_PER_ROUND } from '../constants';
import { useTheme } from '../theme';
import { useVolumeButtons } from '../useVolumeButtons';
import { Icon } from './Icon';
import { Overlay } from './Overlay';

type Props = {
  visible: boolean;
  label: string;
  arabic?: string;
  /** O'zbekcha o'qilishi / ma'nosi */
  text?: string;
  target: number;
  count: number;
  onChange: (n: number) => void;
  onClose: () => void;
  /** "Tahrirlash" bosilganda (zikr matni, nomi, maqsadini o'zgartirish) */
  onEdit?: () => void;
};

const tick = () => {
  if (Platform.OS === 'web') (navigator as any).vibrate?.(10);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => Vibration.vibrate(10));
};
const roundDone = () => {
  if (Platform.OS === 'web') (navigator as any).vibrate?.([30, 40, 30]);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => Vibration.vibrate(40));
};
const allDone = () => {
  if (Platform.OS === 'web') (navigator as any).vibrate?.([60, 60, 120]);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => Vibration.vibrate(300));
};

/** Haqiqiy tasbehga o'xshash donalar halqasi. `pos` — joriy davradagi sanoq. */
function BeadRing({
  size,
  beads,
  pos,
  colors,
}: {
  size: number;
  beads: number;
  pos: number;
  colors: { done: [string, string]; rest: [string, string]; current: [string, string]; cord: string };
}) {
  const c = size / 2;
  const R = size / 2 - size * 0.075;
  const step = (2 * Math.PI) / beads;
  const r = Math.min(size * 0.042, ((Math.PI * R) / beads) * 0.86);

  return (
    <Svg width={size} height={size}>
      <Defs>
        {(['done', 'rest', 'current'] as const).map((k) => (
          <RadialGradient key={k} id={k} cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="0.25" stopColor={colors[k][0]} />
            <Stop offset="1" stopColor={colors[k][1]} />
          </RadialGradient>
        ))}
      </Defs>
      {/* ip */}
      <Circle cx={c} cy={c} r={R} stroke={colors.cord} strokeWidth={1.5} fill="none" />
      {Array.from({ length: beads }, (_, i) => {
        const a = i * step - Math.PI / 2;
        const isCurrent = i === pos % beads;
        const fill = isCurrent ? 'url(#current)' : i < pos ? 'url(#done)' : 'url(#rest)';
        return (
          <G key={i}>
            <Circle cx={c + R * Math.cos(a) + 1} cy={c + R * Math.sin(a) + 2} r={isCurrent ? r * 1.25 : r} fill="#000" opacity={0.12} />
            <Circle cx={c + R * Math.cos(a)} cy={c + R * Math.sin(a)} r={isCurrent ? r * 1.25 : r} fill={fill} />
          </G>
        );
      })}
    </Svg>
  );
}

/** Halqa tepasidagi "imom" donasi va popuk — aylanmaydi, sanash nuqtasini ko'rsatadi. */
function Imam({ color, light }: { color: string; light: string }) {
  return (
    <Svg width={26} height={40}>
      <Line x1={13} y1={26} x2={13} y2={40} stroke={color} strokeWidth={2} />
      <Rect x={6} y={2} width={14} height={26} rx={6} fill={color} />
      <Rect x={9} y={5} width={3} height={18} rx={1.5} fill={light} opacity={0.5} />
      <Path d="M6 10 H20 M6 20 H20" stroke={light} strokeWidth={1} opacity={0.35} />
    </Svg>
  );
}

/** Elektron tasbeh: donalar halqasi aylanadi; ekranga yoki ovoz tugmasiga bosib sanaladi. */
export function TasbehModal({ visible, label, arabic, text, target, count, onChange, onClose, onEdit }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [n, setN] = useState(count);
  const done = n >= target;

  const beads = Math.min(target, BEADS_PER_ROUND);
  const pos = n >= target ? beads : n % beads;
  const round = Math.floor(Math.min(n, target - 1) / beads) + 1;
  const rounds = Math.ceil(target / beads);
  const pct = Math.min(100, Math.round((n / target) * 100));

  const ringSize = Math.min(width - 60, height * 0.34, 330);
  const rot = useRef(new Animated.Value(count)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setN(count);
      rot.setValue(count);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Har sanoqda halqa bir donaga aylanadi
  useEffect(() => {
    Animated.spring(rot, { toValue: n, useNativeDriver: true, friction: 7, tension: 90 }).start();
  }, [n, rot]);

  const set = (v: number) => {
    setN(v);
    onChange(v);
  };

  const inc = () => {
    if (n >= target) return;
    const next = n + 1;
    if (next >= target) allDone();
    else if (next % beads === 0) roundDone();
    else tick();
    pulse.setValue(0.94);
    Animated.timing(pulse, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    set(next);
  };
  const dec = () => n > 0 && set(n - 1);

  // Ovoz tugmasi: yuqori — sanash, past — bittaga qaytarish
  useVolumeButtons(visible && !done, inc, dec);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const beadColors = useMemo(
    () => ({
      done: [colors.primary, isDark ? '#0B5E49' : '#0A5A46'] as [string, string],
      rest: isDark ? (['#3A4D66', '#22324A'] as [string, string]) : (['#C9CFC9', '#9EA8A1'] as [string, string]),
      current: ['#5FE0B9', colors.primary] as [string, string],
      cord: isDark ? '#2C4260' : '#D5CCB6',
    }),
    [colors.primary, isDark],
  );

  if (!visible) return null;
  const stepDeg = 360 / beads;
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `-${stepDeg}deg`], extrapolate: 'extend' });

  return (
    <Overlay>
      <View style={[s.root, { backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12} style={[s.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text }]}>Tasbeh</Text>
          <Pressable
            onPress={dec}
            disabled={n === 0}
            hitSlop={12}
            style={[s.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: n > 0 ? 1 : 0.4 }]}
          >
            <Icon name="undo-variant" size={20} color={colors.text} />
          </Pressable>
        </View>

        <Text style={[s.title, { color: colors.primary }]} numberOfLines={2}>
          {label}
        </Text>
        {arabic ? (
          <View style={[s.arabicBox, { backgroundColor: colors.primarySoft }]}>
            <Text style={[s.arabic, { color: colors.text }]}>{arabic}</Text>
          </View>
        ) : null}

        {/* O'zbekcha o'qilishi + tahrirlash */}
        <View style={[s.textCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: Math.max(64, height * 0.13) }} nestedScrollEnabled>
            <Text style={[s.uzText, { color: text ? colors.text : colors.textMuted }]}>
              {text || "O'zbekcha matn hali yozilmagan. Pastdagi «Tahrirlash» orqali o'zingiz yozishingiz mumkin."}
            </Text>
          </ScrollView>
          {onEdit && (
            <Pressable
              onPress={onEdit}
              hitSlop={6}
              style={({ pressed }) => [s.editBtn, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="pencil-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Tahrirlash</Text>
            </Pressable>
          )}
        </View>

        {/* Butun o'rta qism — bosish zonasi */}
        <Pressable onPress={inc} style={s.zone} disabled={done}>
          <View style={{ width: ringSize, height: ringSize + 20, alignItems: 'center' }}>
            <View style={{ position: 'absolute', top: 0, zIndex: 2 }}>
              <Imam color={colors.primary} light="#FFFFFF" />
            </View>
            <Animated.View style={{ marginTop: 20, transform: [{ rotate }] }}>
              <BeadRing size={ringSize} beads={beads} pos={pos} colors={beadColors} />
            </Animated.View>
            <Animated.View
              style={[
                s.center,
                {
                  top: 20 + ringSize * 0.27,
                  width: ringSize * 0.46,
                  height: ringSize * 0.46,
                  borderRadius: ringSize * 0.23,
                  backgroundColor: done ? colors.primary : colors.hero,
                  transform: [{ scale: pulse }],
                },
              ]}
            >
              {done ? (
                <>
                  <Icon name="check-bold" size={ringSize * 0.12} color="#FFFFFF" />
                  <Text style={s.centerSub}>Bajarildi</Text>
                </>
              ) : (
                <>
                  <Text style={[s.centerCount, { fontSize: ringSize * 0.15 }]}>{pos}</Text>
                  <View style={s.centerPill}>
                    <Text style={s.centerSub}>/ {beads}</Text>
                  </View>
                </>
              )}
            </Animated.View>
          </View>
          <Text style={[s.hint, { color: done ? colors.primary : colors.textMuted }]}>
            {done
              ? 'Alhamdulillah! Maqsadga yetdingiz'
              : Platform.OS === 'android'
                ? 'Ekranga yoki ovoz tugmasiga bosing'
                : 'Istalgan joyga bosing'}
          </Text>
        </Pressable>

        <View style={[s.stats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { icon: 'repeat' as const, value: String(n), label: 'Jami' },
            { icon: 'trending-up' as const, value: `${pct}%`, label: 'Bajarildi' },
            { icon: 'sync' as const, value: `${Math.min(round, rounds)}/${rounds}`, label: 'Davra' },
            { icon: 'flag-outline' as const, value: String(target), label: 'Maqsad' },
          ].map((it, i) => (
            <View key={it.label} style={[s.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
              <Icon name={it.icon} size={16} color={colors.primary} />
              <Text style={[s.statValue, { color: colors.text }]}>{it.value}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>{it.label}</Text>
            </View>
          ))}
        </View>

        {done && (
          <Pressable onPress={onClose} style={({ pressed }) => [s.doneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name="check" size={20} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontSize: 17, fontWeight: '700' }}>Qaytish</Text>
          </Pressable>
        )}
      </View>
    </Overlay>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', paddingHorizontal: 8 },
  arabicBox: { alignSelf: 'center', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10, maxWidth: '100%' },
  arabic: { fontSize: 24, lineHeight: 40, textAlign: 'center', writingDirection: 'rtl' },
  textCard: { borderWidth: 1, borderRadius: 16, marginTop: 10, paddingTop: 10, paddingHorizontal: 14, overflow: 'hidden' },
  uzText: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingBottom: 8 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -14,
  },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  centerCount: { color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'] },
  centerPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, marginTop: -2 },
  centerSub: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 15, marginTop: 12, fontWeight: '600', textAlign: 'center' },
  stats: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12 },
  doneBtn: { marginTop: 12, borderRadius: 16, paddingVertical: 15, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
