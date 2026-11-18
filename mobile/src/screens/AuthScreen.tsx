import React, { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type PhoneStart } from '../api';
import { useAuth } from '../auth';
import { CodeInput } from '../components/CodeInput';
import { KeyboardScrollView } from '../components/KeyboardScrollView';
import { Icon, type IconName } from '../components/Icon';
import { Button } from '../components/ui';
import { storage } from '../storage';
import { useTheme } from '../theme';

type Mode = 'login' | 'register' | 'reset';
type Flow = PhoneStart & { code_sent?: boolean };

const RESEND_SECONDS = 60;
const FLOW_KEY = 'authFlow';

/** Kod bosqichi telefon xotirasida saqlanadi: Telegram'ga o'tib qaytganda (ilova qayta ochilsa ham) yo'qolmaydi. */
type SavedFlow = { flow: Flow; mode: Mode; digits: string; savedAt: number; resendAt?: number };
const saveFlow = (v: SavedFlow | null) =>
  (v ? storage.set(FLOW_KEY, JSON.stringify(v)) : storage.remove(FLOW_KEY)).catch(() => {});

/** "901234567" -> "90 123 45 67" (faqat ko'rinish uchun). */
function formatLocal(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

const botName = (url: string) => '@' + (url.split('/')[3]?.split('?')[0] ?? '');

function PasswordInput({
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={[s.field, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={s.fieldIcon}>
        <Icon name="lock-outline" size={20} color={colors.textMuted} />
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        style={[s.fieldInput, { color: colors.text }]}
      />
      <Pressable onPress={() => setVisible(!visible)} hitSlop={10} style={s.fieldIcon}>
        <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export function AuthScreen() {
  const { colors } = useTheme();
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const digits = phone.replace(/\D/g, '');
  const fullPhone = '+998' + digits;
  const phoneValid = digits.length === 9;

  // Telegram'dan qaytganda kod bosqichini tiklaymiz
  useEffect(() => {
    storage
      .get(FLOW_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as SavedFlow;
        if (Date.now() - saved.savedAt > saved.flow.expires_in * 1000) return saveFlow(null);
        setMode(saved.mode);
        setPhone(formatLocal(saved.digits));
        setFlow(saved.flow);
        if (saved.resendAt) setResendIn(Math.max(0, Math.ceil((saved.resendAt - Date.now()) / 1000)));
      })
      .catch(() => {});
  }, []);

  const startFlow = (v: Flow, m: Mode) => {
    setFlow(v);
    setCode('');
    setCodeError(false);
    const resendAt = v.code_sent ? Date.now() + RESEND_SECONDS * 1000 : undefined;
    setResendIn(v.code_sent ? RESEND_SECONDS : 0);
    saveFlow({ flow: v, mode: m, digits, savedAt: Date.now(), resendAt });
  };

  // Qayta yuborish hisoblagichi
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const wrap = async (fn: () => Promise<void>, onError?: () => void) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
      onError?.();
    } finally {
      setBusy(false);
    }
  };

  const reset = (m: Mode) => {
    setMode(m);
    setError(null);
    setFlow(null);
    saveFlow(null);
    setCode('');
    setCodeError(false);
    setPassword('');
  };

  const needPhone = () => {
    if (!phoneValid) setError("Telefon raqamni to'liq kiriting");
    return phoneValid;
  };

  const onLogin = () => {
    if (!needPhone()) return;
    if (!password) return setError('Parolni kiriting');
    wrap(() => login(fullPhone, password));
  };

  const onStartRegister = () =>
    needPhone() &&
    wrap(async () => {
      // Telegram avtomatik ochilmaydi — foydalanuvchiga havola ko'rsatiladi
      startFlow(await api.phoneStart(fullPhone), 'register');
    });

  const onForgot = () =>
    needPhone() &&
    wrap(async () => {
      startFlow(await api.forgotPassword(fullPhone), 'reset');
    });

  const onSubmitCode = () => {
    if (!flow) return;
    if (code.length !== 6) {
      setCodeError(true);
      return setError('6 xonali kodni kiriting');
    }
    if (password.length < 6) return setError("Parol kamida 6 ta belgidan iborat bo'lsin");
    wrap(
      async () => {
        await (mode === 'reset' ? resetPassword : register)(flow.token, code, password);
        saveFlow(null);
      },
      () => setCodeError(true),
    );
  };

  const field = [s.field, { borderColor: colors.border, backgroundColor: colors.surface }];
  const errorBox = error && (
    <View style={[s.errorBox, { backgroundColor: colors.danger + '1A' }]}>
      <Icon name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{error}</Text>
    </View>
  );
  const textLink = (title: string, onPress: () => void, opts: { icon?: IconName; muted?: boolean; disabled?: boolean } = {}) => {
    const color = opts.disabled || opts.muted ? colors.textMuted : colors.primary;
    return (
      <Pressable onPress={onPress} disabled={opts.disabled} hitSlop={8} style={s.textLink}>
        {opts.icon && <Icon name={opts.icon} size={16} color={color} />}
        <Text style={{ color, fontWeight: '600' }}>{title}</Text>
      </Pressable>
    );
  };

  const header = (
    <>
      <Image source={require('../../assets/icon.png')} style={s.logo} />
      <Text style={[s.title, { color: colors.primary }]}>Niyat</Text>
      <Text style={[s.subtitle, { color: colors.textMuted }]}>Ma'naviy va shaxsiy rivojlanish kundaligi</Text>
    </>
  );

  // ---------------- Kod kiritish bosqichi ----------------
  if (flow) {
    const sent = !!flow.code_sent;
    const mm = Math.floor(resendIn / 60);
    const ss = String(resendIn % 60).padStart(2, '0');
    return (
      <View style={[s.root, { backgroundColor: colors.bg }]}>
        <KeyboardScrollView contentContainerStyle={s.inner}>
          <Pressable onPress={() => reset(mode)} hitSlop={10} style={s.back}>
            <Icon name="arrow-left" size={22} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 15 }}>Orqaga</Text>
          </Pressable>

          <View style={[s.bigIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name={sent ? 'message-lock-outline' : 'send'} size={36} color={colors.primary} />
          </View>
          <Text style={[s.h1, { color: colors.text }]}>
            {mode === 'reset' ? 'Parolni tiklash' : 'Raqamni tasdiqlash'}
          </Text>
          <Text style={[s.lead, { color: colors.textMuted }]}>
            {sent ? 'Tasdiqlash kodi Telegram orqali yuborildi' : "Kodni olish uchun Telegram botga o'ting"}
          </Text>
          <View style={[s.phoneChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="phone-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>+998 {formatLocal(digits)}</Text>
          </View>

          {!sent && (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                <>Botni oching va <Text style={s.bold}>START</Text> bosing</>,
                <><Text style={s.bold}>Raqamni yuborish</Text> tugmasini bosing</>,
                <>Bot yuborgan 6 xonali kodni pastga kiriting</>,
              ].map((t, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: 13 }}>{i + 1}</Text>
                  </View>
                  <Text style={[s.stepText, { color: colors.text }]}>{t}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => Linking.openURL(flow.bot_url)}
                style={({ pressed }) => [s.tgButton, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Icon name="send" size={18} color="#FFFFFF" />
                <Text style={s.tgButtonText}>{botName(flow.bot_url)} ni ochish</Text>
              </Pressable>
            </View>
          )}

          {sent && (
            <Pressable
              onPress={() => Linking.openURL(flow.bot_url.split('?')[0]).catch(() => {})}
              hitSlop={8}
              style={[s.textLink, { alignSelf: 'center', marginTop: 4 }]}
            >
              <Icon name="send" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Kodni ko'rish uchun {botName(flow.bot_url)} ni ochish</Text>
            </Pressable>
          )}

          <Text style={[s.label, { color: colors.text }]}>Tasdiqlash kodi</Text>
          <CodeInput
            value={code}
            error={codeError}
            autoFocus={sent}
            onChange={(v) => {
              setCode(v);
              if (codeError) {
                setCodeError(false);
                setError(null);
              }
            }}
          />

          <Text style={[s.label, { color: colors.text }]}>{mode === 'reset' ? 'Yangi parol' : "Parol o'rnating"}</Text>
          <PasswordInput value={password} onChange={setPassword} placeholder="Kamida 6 ta belgi" onSubmit={onSubmitCode} />

          {errorBox}
          <Button
            title={mode === 'reset' ? 'Parolni yangilash' : "Ro'yxatdan o'tish"}
            icon={mode === 'reset' ? 'lock-reset' : 'account-check-outline'}
            onPress={onSubmitCode}
            loading={busy}
          />

          <View style={s.footerLinks}>
            {sent || mode === 'reset' ? (
              resendIn > 0 ? (
                textLink(`Qayta yuborish ${mm}:${ss}`, () => {}, { icon: 'timer-sand', disabled: true })
              ) : (
                textLink('Kodni qayta yuborish', mode === 'reset' ? onForgot : onStartRegister, { icon: 'refresh' })
              )
            ) : (
              textLink('Botni ochish', () => Linking.openURL(flow.bot_url), { icon: 'send' })
            )}
            {textLink("Raqamni o'zgartirish", () => reset(mode), { muted: true })}
          </View>
          <Text style={[s.note, { color: colors.textMuted }]}>Kod 5 daqiqa amal qiladi. Uni hech kimga bermang.</Text>
        </KeyboardScrollView>
      </View>
    );
  }

  // ---------------- Raqam kiritish / kirish ----------------
  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <KeyboardScrollView contentContainerStyle={s.inner}>
        {header}

        {mode === 'reset' ? (
          <View style={s.resetTitleRow}>
            <Icon name="key-variant" size={22} color={colors.primary} />
            <Text style={[s.h2, { color: colors.text }]}>Parolni tiklash</Text>
          </View>
        ) : (
          <View style={[s.tabs, { backgroundColor: colors.surfaceAlt }]}>
            {(['login', 'register'] as Mode[]).map((m) => (
              <Pressable key={m} onPress={() => reset(m)} style={[s.tab, mode === m && { backgroundColor: colors.surface }]}>
                <Text style={{ color: mode === m ? colors.primary : colors.textMuted, fontWeight: '700' }}>
                  {m === 'login' ? 'Kirish' : "Ro'yxatdan o'tish"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={field}>
          <View style={s.fieldIcon}>
            <Icon name="phone-outline" size={20} color={colors.textMuted} />
          </View>
          <Text style={[s.prefix, { color: colors.text }]}>+998</Text>
          <TextInput
            placeholder="90 123 45 67"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={formatLocal(phone)}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
            style={[s.fieldInput, { color: colors.text, paddingLeft: 6 }]}
          />
        </View>

        {mode === 'login' && (
          <>
            <PasswordInput value={password} onChange={setPassword} placeholder="Parol" onSubmit={onLogin} />
            {errorBox}
            <Button title="Kirish" icon="login" onPress={onLogin} loading={busy} />
            <View style={s.footerLinks}>{textLink('Parolni unutdim?', () => reset('reset'), { icon: 'key-variant' })}</View>
          </>
        )}

        {mode === 'register' && (
          <>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              Raqamingiz Telegram bot orqali tasdiqlanadi. Telegram'dagi raqamingizni kiriting.
            </Text>
            {errorBox}
            <Button title="Telegram orqali tasdiqlash" icon="send" onPress={onStartRegister} loading={busy} />
          </>
        )}

        {mode === 'reset' && (
          <>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              Ro'yxatdan o'tgan raqamingizni kiriting — tiklash kodi Telegram orqali yuboriladi.
            </Text>
            {errorBox}
            <Button title="Kodni Telegram'ga yuborish" icon="send" onPress={onForgot} loading={busy} />
            <View style={s.footerLinks}>{textLink('Kirishga qaytish', () => reset('login'), { icon: 'arrow-left', muted: true })}</View>
          </>
        )}

      </KeyboardScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 440, width: '100%', alignSelf: 'center' },
  logo: { width: 88, height: 88, borderRadius: 22, alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28, marginTop: 6 },
  h1: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  h2: { fontSize: 20, fontWeight: '700' },
  lead: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  bold: { fontWeight: '700' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 12 },
  bigIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
    marginBottom: 22,
  },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 20, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2AABEE', // Telegram ko'k rangi
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  tgButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  resetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, marginBottom: 12, minHeight: 52 },
  fieldIcon: { paddingHorizontal: 12, justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 16, paddingVertical: 14, paddingRight: 8 },
  prefix: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 12 },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8, marginTop: 18 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  serverInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
});
