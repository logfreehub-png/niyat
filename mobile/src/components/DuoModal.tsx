import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { DUO_TEXT } from '../constants';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Button } from './ui';

type Props = {
  visible: boolean;
  text: string;
  completed: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
};

export function DuoModal({ visible, text, completed, onSubmit, onClose }: Props) {
  const { colors } = useTheme();
  const [value, setValue] = useState(text);

  useEffect(() => {
    if (visible) setValue(text);
  }, [visible, text]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Icon name="hands-pray" size={34} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.primary }]}>Duo vaqti</Text>
          <Text style={[s.text, { color: colors.text }]}>{DUO_TEXT}</Text>
          <TextInput
            multiline
            value={value}
            onChangeText={setValue}
            placeholder="Istaklaringiz va duolaringizni yozing…"
            placeholderTextColor={colors.textMuted}
            style={[s.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
          />
          <Button title={completed ? 'Saqlash' : 'Duo qildim'} icon="check" onPress={() => onSubmit(value)} />
          <View style={{ height: 8 }} />
          <Button title="Keyinroq" variant="ghost" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 24, borderWidth: 1, padding: 20 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  text: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginVertical: 14, fontStyle: 'italic' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 120, fontSize: 15, textAlignVertical: 'top', marginBottom: 14 },
});
