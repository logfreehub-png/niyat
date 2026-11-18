import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { KeyboardScrollView } from '../components/KeyboardScrollView';
import { Icon, type IconName } from '../components/Icon';
import { ProfileCard } from '../components/ProfileCard';
import { Button, Card, SectionTitle } from '../components/ui';
import { PRAYERS, type PrayerKey } from '../constants';
import * as notify from '../notifications';
import { useTheme, type ThemeMode } from '../theme';
import { WIDGETS, pinWidget } from '../widgets';

const MODES: { key: ThemeMode; label: string; icon: IconName }[] = [
  { key: 'system', label: 'Tizim', icon: 'theme-light-dark' },
  { key: 'light', label: "Yorug'", icon: 'white-balance-sunny' },
  { key: 'dark', label: 'Tungi', icon: 'weather-night' },
];

function NotificationsCard() {
  const { colors } = useTheme();
  const [enabled, setEnabledState] = useState(true);
  const [which, setWhich] = useState<Record<PrayerKey, boolean> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    notify.isEnabled().then(setEnabledState);
    notify.enabledPrayers().then(setWhich);
  }, []);

  const toggle = async (v: boolean) => {
    setEnabledState(v);
    const ok = await notify.setEnabled(v);
    if (!ok) {
      setEnabledState(false);
      await notify.setEnabled(false);
      setMsg("Bildirishnomaga ruxsat berilmadi. Telefon sozlamalari → Ilovalar → Niyat → Bildirishnomalar bo'limidan yoqing.");
    } else setMsg(v ? 'Namoz vaqtlari eslatmalari yoqildi' : null);
  };

  const togglePrayer = async (key: PrayerKey) => {
    if (!which) return;
    const next = { ...which, [key]: !which[key] };
    setWhich(next);
    await notify.setPrayerEnabled(key, next[key]);
  };

  return (
    <Card>
      <SectionTitle
        icon="bell-ring-outline"
        right={
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
          />
        }
      >
        Namoz eslatmalari
      </SectionTitle>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
        Har bir namoz vaqti kirganda telefonga bildirishnoma keladi. Vaqtlar joylashuvingiz bo'yicha hisoblanadi.
      </Text>
      {enabled && which && (
        <View style={[s.row, { marginBottom: 12 }]}>
          {PRAYERS.map((p) => {
            const on = which[p.key];
            return (
              <Pressable
                key={p.key}
                onPress={() => togglePrayer(p.key)}
                style={[s.chip, { paddingVertical: 8 }, on ? { backgroundColor: colors.primarySoft, borderColor: colors.primary } : { borderColor: colors.border }]}
              >
                <Icon name={on ? 'bell' : 'bell-off-outline'} size={16} color={on ? colors.primary : colors.textMuted} />
                <Text style={{ color: on ? colors.primary : colors.textMuted, fontWeight: '700', fontSize: 12, marginTop: 2 }}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {msg && <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>{msg}</Text>}
      {enabled && (
        <Button
          title="Sinab ko'rish (5 soniyada)"
          icon="bell-outline"
          variant="ghost"
          onPress={async () => setMsg((await notify.sendTestNotification()) ? 'Bildirishnoma 5 soniyada keladi…' : "Ruxsat yo'q yoki bu qurilmada ishlamaydi")}
        />
      )}
    </Card>
  );
}

export function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();

  return (
    <KeyboardScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <ProfileCard />

      <Card>
        <SectionTitle icon="palette-outline">Mavzu</SectionTitle>
        <View style={s.row}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  s.chip,
                  active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border },
                ]}
              >
                <Icon name={m.icon} size={20} color={active ? colors.primaryText : colors.textMuted} />
                <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: '600', marginTop: 4 }}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {Platform.OS !== 'web' && <NotificationsCard />}

      {Platform.OS === 'android' && (
        <Card>
          <SectionTitle icon="widgets-outline">Vidjetlar</SectionTitle>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
            Ilovaga kirmasdan kunlik reja, majburiyatlar va bugungi holatni uy ekranida ko'ring. Yoki uy ekranini bosib
            turing → Vidjetlar → Niyat.
          </Text>
          <View style={{ gap: 8 }}>
            <Button title="Reja va majburiyatlar vidjeti" icon="format-list-checks" variant="ghost" onPress={() => pinWidget(WIDGETS.plans)} />
            <Button title="Bugungi holat vidjeti" icon="chart-donut" variant="ghost" onPress={() => pinWidget(WIDGETS.today)} />
          </View>
        </Card>
      )}

    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 8 },
});
