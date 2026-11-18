import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  onComplete?: (v: string) => void;
  autoFocus?: boolean;
};

/** 6 katakli tasdiqlash kodi maydoni. Ko'rinmas TextInput kataklar ustida turadi. */
export function CodeInput({ value, onChange, length = 6, error, onComplete, autoFocus = true }: Props) {
  const { colors } = useTheme();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handle = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };

  return (
    <Pressable onPress={() => ref.current?.focus()} style={s.wrap}>
      <View style={s.row}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? '';
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          const borderColor = error ? colors.danger : active ? colors.primary : digit ? colors.primary : colors.border;
          return (
            <View
              key={i}
              style={[
                s.cell,
                {
                  borderColor,
                  borderWidth: active || error ? 2 : 1.5,
                  backgroundColor: digit ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text style={[s.digit, { color: error ? colors.danger : colors.text }]}>{digit}</Text>
              {active && !digit && <View style={[s.caret, { backgroundColor: colors.primary }]} />}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={s.hidden}
        accessibilityLabel="Tasdiqlash kodi"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  caret: { position: 'absolute', width: 2, height: 26, borderRadius: 1 },
  // Butun maydon ustida turadi — bosish va joylashtirish (paste) ishlaydi, lekin ko'rinmaydi
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1, backgroundColor: 'transparent', borderWidth: 0 },
});
