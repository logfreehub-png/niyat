import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({
  children,
  right,
  icon,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {icon && (
          <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
            <Icon name={icon} size={18} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>
      </View>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.primary }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.primaryText : colors.primary} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={18} color={primary ? colors.primaryText : colors.text} />}
          <Text style={[styles.buttonText, { color: primary ? colors.primaryText : colors.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.fill, { width: `${Math.min(100, value)}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const NUM_LINE = /^\s*(?:✓\s*)?(\d+)[.)]\s?/;

/**
 * Raqamli ro'yxat: Enter bosilganda keyingi qator "N. " bilan boshlanadi.
 * Bo'sh band ("3. ") ustida yana Enter bosilsa — ro'yxat tugaydi (raqam olib tashlanadi).
 */
export function autoNumber(prev: string, next: string): string {
  if (next.length !== prev.length + 1) return next;
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i++;
  if (next[i] !== '\n') return next;
  const lineStart = next.lastIndexOf('\n', i - 1) + 1;
  const line = next.slice(lineStart, i);
  const m = line.match(NUM_LINE);
  if (m && line.replace(NUM_LINE, '').trim() === '') {
    // Bo'sh band — ro'yxatni tugatamiz
    return next.slice(0, lineStart) + next.slice(i + 1);
  }
  const count = next.slice(0, i).split('\n').filter((l) => NUM_LINE.test(l)).length;
  const n = m ? Number(m[1]) + 1 : count + 1;
  return next.slice(0, i + 1) + `${n}. ` + next.slice(i + 1);
}

/** Oxiridagi bo'sh bandlarni ("4. ") olib tashlaydi. */
function trimEmptyItem(v: string): string {
  const lines = v.split('\n');
  while (lines.length && /^\s*(?:✓\s*)?\d+[.)]\s*$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join('\n');
}

/** Yozish to'xtagach (yoki maydondan chiqqanda) avtomatik saqlaydigan kundalik maydoni. */
export function AutoSaveInput({
  label,
  value,
  onSave,
  placeholder,
  minHeight = 80,
  icon,
  hint,
  numbered,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  icon?: IconName;
  hint?: string;
  /** Raqamli ro'yxat (1. 2. 3.) — Enter bosilganda keyingi raqam qo'yiladi */
  numbered?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const [state, setState] = useState<'idle' | 'typing' | 'saved'>('idle');
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(value);

  useEffect(() => {
    setText(value);
    last.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const save = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v !== last.current) {
      last.current = v;
      onSave(v);
      setState('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setState('idle'), 1800);
    } else if (state === 'typing') setState('idle');
  };

  const filled = text.trim().length > 0;

  return (
    <View
      style={[
        styles.note,
        {
          backgroundColor: colors.bg,
          borderColor: focused ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.noteHead}>
        {icon && (
          <View style={[styles.noteIcon, { backgroundColor: filled ? colors.primary : colors.primarySoft }]}>
            <Icon name={icon} size={16} color={filled ? colors.primaryText : colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{hint}</Text> : null}
        </View>
        {state !== 'idle' && (
          <View style={[styles.savePill, { backgroundColor: state === 'saved' ? colors.primarySoft : colors.surfaceAlt }]}>
            <Icon
              name={state === 'saved' ? 'check' : 'pencil-outline'}
              size={12}
              color={state === 'saved' ? colors.primary : colors.textMuted}
            />
            <Text style={{ color: state === 'saved' ? colors.primary : colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              {state === 'saved' ? 'Saqlandi' : 'yozilmoqda'}
            </Text>
          </View>
        )}
      </View>
      <TextInput
        multiline
        value={text}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={() => {
          setFocused(true);
          if (numbered && !text.trim()) setText('1. ');
        }}
        onChangeText={(raw) => {
          const v = numbered ? autoNumber(text, raw) : raw;
          setText(v);
          setState('typing');
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 1200);
        }}
        onBlur={() => {
          setFocused(false);
          const v = numbered ? trimEmptyItem(text) : text;
          if (v !== text) setText(v);
          save(v);
        }}
        style={[styles.noteInput, { minHeight, color: colors.text }]}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  note: { borderWidth: 1.5, borderRadius: 16, padding: 12, marginBottom: 12 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  noteIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noteInput: { fontSize: 15, lineHeight: 22, textAlignVertical: 'top', paddingHorizontal: 2, paddingVertical: 4 },
  savePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
