import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type HistoryItem } from '../api';
import { KeyboardScrollView } from '../components/KeyboardScrollView';
import { Icon } from '../components/Icon';
import { AutoSaveInput, Card, SectionTitle } from '../components/ui';
import { prettyDate } from '../date';
import { useTheme } from '../theme';
import type { useDay } from '../useDay';

type DayState = ReturnType<typeof useDay>;

export function ReflectionScreen({ date, state }: { date: string; state: DayState }) {
  const { colors } = useTheme();
  const { day, saveReflection } = state;
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    api.history(date, 7).then(setHistory).catch(() => {});
  }, [date, day?.reflection.overall_score]);

  if (!day) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const score = day.reflection.overall_score;

  return (
    <KeyboardScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.content}>
      <Card>
        <SectionTitle icon="weather-night">Kechki xulosa</SectionTitle>
        <AutoSaveInput
          icon="emoticon-outline"
          label="Bugun o'zimni qanday his qildim?"
          value={day.reflection.feel_today}
          onSave={(v) => saveReflection({ feel_today: v })}
        />
        <AutoSaveInput
          icon="hand-heart-outline"
          label="Qanday yaxshiliklar qildim?"
          value={day.reflection.good_deeds}
          onSave={(v) => saveReflection({ good_deeds: v })}
        />
        <AutoSaveInput
          icon="wrench-outline"
          label="Qanday xato/nuqsonimni to'g'irlashim kerak?"
          value={day.reflection.mistakes_to_fix}
          onSave={(v) => saveReflection({ mistakes_to_fix: v })}
        />

        <Text style={[s.label, { color: colors.text }]}>Bugungi kunimga umumiy baho</Text>
        <View style={s.scoreRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = score === n;
            return (
              <Pressable
                key={n}
                onPress={() => saveReflection({ overall_score: n })}
                style={[
                  s.scoreBtn,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { borderColor: colors.border, backgroundColor: colors.bg },
                ]}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 17, fontWeight: '700' }}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        {score != null && (
          <Text style={{ color: colors.primary, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
            Baho: {score}/10
          </Text>
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <SectionTitle icon="chart-line">So'nggi 7 kun</SectionTitle>
          {history
            .slice()
            .reverse()
            .map((h) => (
              <View key={h.date} style={[s.histRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{prettyDate(h.date)}</Text>
                <View style={[s.stat, { width: 44 }]}>
                  <Icon name="mosque" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }}>{h.prayers_done}</Text>
                </View>
                <View style={[s.stat, { width: 62 }]}>
                  <Icon name="star-crescent" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }}>{h.adhkar_progress}%</Text>
                </View>
                <Text style={{ color: colors.primary, width: 36, textAlign: 'right', fontWeight: '700' }}>
                  {h.overall_score ?? '—'}
                </Text>
              </View>
            ))}
        </Card>
      )}
    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  scoreBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
