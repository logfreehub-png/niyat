import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type DayZikr } from '../api';
import { DuoModal } from '../components/DuoModal';
import { KeyboardScrollView } from '../components/KeyboardScrollView';
import { Icon, type IconName } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { TasbehModal } from '../components/TasbehModal';
import { ZikrEditor } from '../components/ZikrEditor';
import { AutoSaveInput, Button, Card, SectionTitle } from '../components/ui';
import { SkyScene, currentPeriod } from '../components/SkyScene';
import { PRAYER_ICONS, PRAYERS, type PrayerKey } from '../constants';
import { addDays, hhmm, isoDate, untilText } from '../date';
import { reschedulePrayerNotifications } from '../notifications';
import { computeTimes, getCoords, nextPrayer, type TimesMap } from '../prayerTimes';
import { useTheme } from '../theme';
import type { useDay } from '../useDay';

type DayState = ReturnType<typeof useDay>;

const HERO_MUTED = 'rgba(255,255,255,0.82)';
const HERO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

export function TodayScreen({ date, state }: { date: string; state: DayState }) {
  const { colors } = useTheme();
  const { day, loading, error, reload, refresh, togglePrayer, setZikrCount, updateAdhkar, flushAdhkar, saveLog } = state;
  const [openId, setOpenId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ zikr: DayZikr | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [duoOpen, setDuoOpen] = useState(false);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const dayRef = useRef<number | null>(null);
  dayRef.current = day?.zikrs.length ?? null;
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [now, setNow] = useState(new Date());
  const wasDone = useRef<boolean | null>(null);

  useEffect(() => {
    getCoords().then((c) => {
      setCoords(c);
      // Joylashuv aniqlangach eslatmalarni aniq vaqtlarga moslaymiz
      reschedulePrayerNotifications().catch(() => {});
    });
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const times: TimesMap | null = useMemo(() => {
    if (!coords) return null;
    const [y, m, d] = date.split('-').map(Number);
    return computeTimes(new Date(y, m - 1, d), coords);
  }, [coords, date]);

  // Oldingi kun (kecha) natijasi — asosiy kartada solishtirish uchun
  useEffect(() => {
    let alive = true;
    api
      .history(date, 2)
      .then((h) => {
        const y = h.find((x) => x.date === addDays(date, -1));
        // Kechagi zikrlar soni ma'lum emas — bugungi ro'yxat soni bilan baholaymiz
        const n = dayRef.current ?? 6;
        if (alive) setPrevScore(y ? (y.prayers_done + (y.adhkar_progress / 100) * n) / (5 + n) : null);
      })
      .catch(() => alive && setPrevScore(null));
    return () => {
      alive = false;
    };
  }, [date, loading]);

  const isToday = date === isoDate(now);
  const next = times && coords && isToday ? nextPrayer(times, coords, now) : null;

  // Barcha zikrlar shu sessiyada tugatilsa — Duo oynasini avtomatik ochamiz
  useEffect(() => {
    if (!day) return;
    if (wasDone.current === false && day.adhkar_all_done && !day.adhkar.duo_completed) setDuoOpen(true);
    wasDone.current = day.adhkar_all_done;
  }, [day?.adhkar_all_done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!day) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <Icon name="cloud-off-outline" size={40} color={colors.textMuted} />
            <Text style={{ color: colors.danger, marginVertical: 12, textAlign: 'center' }}>{error}</Text>
            <Button title="Qayta urinish" icon="refresh" onPress={reload} />
          </>
        )}
      </View>
    );
  }

  const prayersDone = PRAYERS.filter((p) => day.prayers[p.key]).length;
  const zikrs = day.zikrs;
  const adhkarDone = zikrs.filter((z) => z.count >= z.target).length;
  // Kunlik natija: 5 ta namoz va har bir zikr teng ulushda (zikr qisman bajarilsa — qisman)
  const zikrSum = zikrs.reduce((acc, z) => acc + (z.target > 0 ? Math.min(z.count, z.target) / z.target : 0), 0);
  const dayScore = (prayersDone + zikrSum) / (5 + zikrs.length);
  const current = zikrs.find((z) => z.id === openId);
  const canEdit = !!day.zikrsSupported;
  const trend = prevScore === null ? null : Math.round(dayScore * 100) - Math.round(prevScore * 100);
  const openEditor = (zikr: DayZikr | null) => {
    if (!canEdit) {
      setNotice("Zikrlarni tahrirlash uchun server yangilanishi kerak. Birozdan so'ng qayta urinib ko'ring.");
      return;
    }
    setNotice(null);
    setEditor({ zikr });
  };
  // Manzara: bugun — hozirgi namoz vaqti; boshqa kunlar — tun
  const period: PrayerKey = times && isToday ? currentPeriod(times, now) : 'isha';

  return (
    <>
      <KeyboardScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={[s.errorBox, { backgroundColor: colors.danger + '1A' }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={{ color: colors.danger, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* ---------- Asosiy karta ---------- */}
        <View style={[s.hero, { backgroundColor: colors.hero }]}>
          <SkyScene period={period} />
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              {next ? (
                <>
                  <Text style={s.heroLabel}>Navbatdagi namoz</Text>
                  <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {next.label}
                  </Text>
                  <Text style={s.heroTime}>{hhmm(next.time)}</Text>
                  <View style={s.heroRow}>
                    <Icon name="timer-sand" size={14} color={HERO_MUTED} />
                    <Text style={s.heroSub}>{untilText(next.time, now)} qoldi</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.heroLabel}>{isToday ? 'Bugungi kun' : 'Kun yakuni'}</Text>
                  <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    Kunlik natija
                  </Text>
                </>
              )}
            </View>
            <View style={s.rings}>
              <View style={s.prevWrap}>
                <View style={[s.ringBackdrop, { borderRadius: 28 }]}>
                  <ProgressRing size={56} stroke={5} progress={prevScore ?? 0} color="#F4D58D" track="rgba(255,255,255,0.22)">
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                      {prevScore === null ? '—' : `${Math.round(prevScore * 100)}%`}
                    </Text>
                    <Text style={{ color: HERO_MUTED, fontSize: 9, marginTop: -1 }}>{isToday ? 'kecha' : 'oldingi'}</Text>
                  </ProgressRing>
                </View>
                {trend !== null && trend !== 0 && (
                  <View style={s.trend}>
                    <Icon name={trend > 0 ? 'arrow-up' : 'arrow-down'} size={11} color={trend > 0 ? '#7BE3B9' : '#FFB4A8'} />
                    <Text style={{ color: trend > 0 ? '#7BE3B9' : '#FFB4A8', fontSize: 11, fontWeight: '800' }}>{Math.abs(trend)}%</Text>
                  </View>
                )}
              </View>
              <View style={s.ringBackdrop}>
                <ProgressRing size={80} stroke={7} progress={dayScore} color="#FFFFFF" track="rgba(255,255,255,0.25)">
                  <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{Math.round(dayScore * 100)}%</Text>
                  <Text style={{ color: HERO_MUTED, fontSize: 10, marginTop: -2 }}>{isToday ? 'bugun' : 'shu kun'}</Text>
                </ProgressRing>
              </View>
            </View>
          </View>
          <View style={s.heroStats}>
            <View style={s.heroChip}>
              <Icon name="mosque" size={14} color="#FFFFFF" />
              <Text style={s.heroChipText}>{prayersDone}/5</Text>
            </View>
            <View style={s.heroChip}>
              <Icon name="star-crescent" size={14} color="#FFFFFF" />
              <Text style={s.heroChipText}>{day.adhkar_progress}%</Text>
            </View>
            <View style={s.heroChip}>
              <Icon name={day.adhkar.duo_completed ? 'check-circle' : 'hands-pray'} size={14} color="#FFFFFF" />
              <Text style={s.heroChipText}>Duo</Text>
            </View>
          </View>
        </View>

        {/* ---------- Affirmatsiya ---------- */}
        {day.log.affirmation ? (
          <View style={[s.quote, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}>
            <Icon name="format-quote-open" size={22} color={colors.primary} />
            <Text style={[s.quoteText, { color: colors.text }]}>{day.log.affirmation}</Text>
          </View>
        ) : null}

        {/* ---------- 1-bo'lim: Namozlar ---------- */}
        <Card>
          <SectionTitle icon="mosque" right={<Text style={[s.count, { color: colors.textMuted }]}>{prayersDone}/5</Text>}>
            Besh mahal namoz
          </SectionTitle>
          <View style={s.prayerGrid}>
            {PRAYERS.map((p) => {
              const done = day.prayers[p.key];
              const isNext = next?.key === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => togglePrayer(p.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={p.label}
                  style={({ pressed }) => [
                    s.prayerTile,
                    {
                      backgroundColor: done ? colors.primarySoft : colors.bg,
                      borderColor: isNext ? colors.primary : done ? colors.primarySoft : colors.border,
                      borderWidth: isNext ? 1.5 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      s.prayerCheck,
                      done ? { backgroundColor: colors.primary } : { borderWidth: 1.5, borderColor: colors.border },
                    ]}
                  >
                    <Icon
                      name={done ? 'check' : PRAYER_ICONS[p.key]}
                      size={done ? 16 : 17}
                      color={done ? colors.primaryText : isNext ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <Text style={[s.prayerName, { color: colors.text }]} numberOfLines={1}>
                    {p.label}
                  </Text>
                  <Text style={[s.prayerTime, { color: isNext ? colors.primary : colors.textMuted }]}>
                    {times ? hhmm(times[p.key]) : '--:--'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ---------- 2-bo'lim: Zikr va salovatlar ---------- */}
        <Card>
          <SectionTitle icon="star-crescent">Zikr va salovatlar</SectionTitle>

          {/* Umumiy natija */}
          <View style={[s.zikrSummary, { backgroundColor: colors.primarySoft }]}>
            <ProgressRing size={64} stroke={6} progress={day.adhkar_progress / 100} color={colors.primary} track={colors.surface}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '800' }}>{day.adhkar_progress}%</Text>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                {zikrs.length && adhkarDone === zikrs.length ? 'Barchasi bajarildi' : `${adhkarDone} / ${zikrs.length} bajarildi`}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                Zikrni tanlang — tasbeh ochiladi. Yon tomonga suring, oxirida «+» bilan yangisini qo'shing.
              </Text>
            </View>
          </View>

          {notice && (
            <View style={[s.notice, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="information-outline" size={16} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{notice}</Text>
            </View>
          )}

          {/* Gorizontal ro'yxat: sig'masa yon tomonga suriladi, oxirida "+" */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.zikrScroll}
            contentContainerStyle={s.zikrRow}
            nestedScrollEnabled
          >
            {zikrs.map((z) => {
              const done = z.count >= z.target;
              const pct = Math.min(1, z.count / z.target);
              return (
                <Pressable
                  key={z.id}
                  onPress={() => setOpenId(z.id)}
                  onLongPress={() => openEditor(z)}
                  accessibilityLabel={`${z.title}: ${z.count} / ${z.target}`}
                  style={({ pressed }) => [
                    s.zikrCard,
                    {
                      backgroundColor: done ? colors.primarySoft : colors.bg,
                      borderColor: done ? colors.primary : colors.border,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <View style={s.zikrCardTop}>
                    <View style={[s.zikrIcon, { backgroundColor: done ? colors.primary : colors.surfaceAlt }]}>
                      <Icon name={done ? 'check-bold' : ((z.icon as IconName) ?? 'star-four-points-outline')} size={20} color={done ? colors.primaryText : colors.primary} />
                    </View>
                    {(z.is_custom || z.edited) && (
                      <View style={[s.badge, { backgroundColor: colors.surfaceAlt }]}>
                        <Icon name={z.is_custom ? 'account-outline' : 'pencil-outline'} size={11} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text style={[s.zikrName, { color: colors.text }]} numberOfLines={2}>
                    {z.title}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <View style={[s.zikrTrack, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: colors.primary }} />
                  </View>
                  <View style={s.zikrCountRow}>
                    <Text style={[s.zikrCount, { color: done ? colors.primary : colors.text }]}>{z.count}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}> / {z.target}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => openEditor(null)}
              accessibilityLabel="Yangi zikr qo'shish"
              style={({ pressed }) => [s.zikrCard, s.addCard, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[s.addCircle, { backgroundColor: colors.primary }]}>
                <Icon name="plus" size={30} color={colors.primaryText} />
              </View>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15, marginTop: 10 }}>Yangi zikr</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 }}>o'zingiz qo'shing</Text>
            </Pressable>
          </ScrollView>

          <Pressable
            onPress={() => day.adhkar_all_done && setDuoOpen(true)}
            disabled={!day.adhkar_all_done}
            style={[
              s.duo,
              day.adhkar_all_done
                ? { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderStyle: 'solid' }
                : { borderColor: colors.border },
            ]}
          >
            <View style={[s.duoIcon, { backgroundColor: day.adhkar_all_done ? colors.primary : colors.surfaceAlt }]}>
              <Icon name="hands-pray" size={20} color={day.adhkar_all_done ? colors.primaryText : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                Duo{day.adhkar.duo_completed ? ' — qilindi' : ''}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                {day.adhkar_all_done
                  ? day.adhkar.duo_completed
                    ? "Duoingizni ko'rish yoki tahrirlash"
                    : 'Barcha zikrlar bajarildi — duo qilish vaqti'
                  : `Yana ${zikrs.length - adhkarDone} ta zikr qoldi`}
              </Text>
            </View>
            <Icon
              name={day.adhkar.duo_completed ? 'check-circle' : day.adhkar_all_done ? 'chevron-right' : 'lock-outline'}
              size={20}
              color={day.adhkar_all_done ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </Card>

        {/* ---------- 3-bo'lim: Shaxsiy yozuvlar ---------- */}
        <Card>
          <SectionTitle icon="notebook-edit-outline">Shaxsiy yozuvlar</SectionTitle>
          <AutoSaveInput
            icon="format-list-checks"
            label="Kunlik reja va majburiyatlar"
            hint="Enter — keyingi band. Uy ekranidagi vidjetda ko'rinadi"
            placeholder={"1. Kitob o'qish\n2. Yugurish\n3. Dasturlash bilan shug'ullanish"}
            numbered
            value={day.log.daily_plans}
            onSave={(v) => saveLog({ daily_plans: v })}
            minHeight={96}
          />
          <AutoSaveInput
            icon="hand-heart-outline"
            label="Bugungi shukronalarim"
            hint="Bugun nimalar uchun minnatdorsiz?"
            placeholder="Sog'ligim, oilam, …"
            value={day.log.gratitudes}
            onSave={(v) => saveLog({ gratitudes: v })}
          />
          <AutoSaveInput
            icon="account-star-outline"
            label="Men shunday insonman"
            hint="Vidjetda ko'rinadi"
            placeholder="Masalan: Men sabrli va mehribon insonman"
            value={day.log.affirmation}
            onSave={(v) => saveLog({ affirmation: v })}
            minHeight={52}
          />
        </Card>
      </KeyboardScrollView>

      {current && (
        <TasbehModal
          visible
          label={current.title}
          text={current.text}
          target={current.target}
          count={current.count}
          onChange={(n) => setZikrCount(current.id, n)}
          onEdit={canEdit ? () => openEditor(current) : undefined}
          onClose={() => {
            setOpenId(null);
            flushAdhkar();
          }}
        />
      )}

      <ZikrEditor
        visible={!!editor}
        zikr={editor?.zikr}
        onClose={() => setEditor(null)}
        onSaved={(deletedId) => {
          setEditor(null);
          if (deletedId !== undefined && deletedId === openId) setOpenId(null);
          refresh();
        }}
      />

      <DuoModal
        visible={duoOpen}
        text={day.adhkar.duo_text}
        completed={day.adhkar.duo_completed}
        onClose={() => setDuoOpen(false)}
        onSubmit={(text) => {
          updateAdhkar({ duo_text: text, duo_completed: true }, true);
          setDuoOpen(false);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 12 },
  count: { fontSize: 15, fontWeight: '700' },

  // Manzara ustidagi matn har doim oq (osmon foni har qanday mavzuda to'q)
  hero: { borderRadius: 24, padding: 18, marginBottom: 16, minHeight: 212, overflow: 'hidden', justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rings: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prevWrap: { alignItems: 'center' },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  ringBackdrop: { borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.22)' },
  heroLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: HERO_MUTED },
  heroTitle: { fontSize: 28, fontWeight: '800', marginTop: 2, color: '#FFFFFF', ...HERO_SHADOW },
  heroTime: { fontSize: 24, fontWeight: '500', color: '#FFFFFF', marginTop: -2, fontVariant: ['tabular-nums'], ...HERO_SHADOW },
  heroSub: { color: HERO_MUTED, fontSize: 13, fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  heroStats: { flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroChipText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  quote: { borderLeftWidth: 4, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', gap: 8 },
  quoteText: { flex: 1, fontSize: 16, lineHeight: 23, fontStyle: 'italic' },

  prayerGrid: { flexDirection: 'row', gap: 6 },
  prayerTile: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 2 },
  prayerCheck: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  prayerName: { fontSize: 13, fontWeight: '700' },
  prayerTime: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },

  zikrSummary: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 12, marginBottom: 12 },
  notice: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 12, padding: 10, marginBottom: 10 },
  zikrScroll: { marginHorizontal: -16, marginBottom: 4 },
  zikrRow: { paddingHorizontal: 16, gap: 10, paddingVertical: 2 },
  zikrCard: { width: 146, minHeight: 158, borderWidth: 1, borderRadius: 18, padding: 12 },
  zikrCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  badge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addCard: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', width: 120 },
  addCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  zikrIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  zikrName: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  zikrTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  zikrCountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  zikrCount: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },

  duo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  duoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
