import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type DayZikr } from '../api';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';

export const ZIKR_ICONS: IconName[] = [
  'star-four-points-outline',
  'heart-outline',
  'water-outline',
  'shield-star-outline',
  'book-open-variant',
  'star-crescent',
  'hands-pray',
  'flower-outline',
  'leaf',
  'white-balance-sunny',
  'weather-night',
  'book-open-page-variant-outline',
];

type Props = {
  visible: boolean;
  /** Tahrirlanadigan zikr; yo'q bo'lsa — yangi zikr qo'shiladi */
  zikr?: DayZikr | null;
  onClose: () => void;
  /** Saqlangandan/o'chirilgandan keyin (ro'yxatni qayta yuklash uchun) */
  onSaved: (deletedId?: number) => void;
};

/** Zikr qo'shish yoki tahrirlash oynasi. Default zikr o'zgarishi faqat shu foydalanuvchi uchun saqlanadi. */
export function ZikrEditor({ visible, zikr, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const isNew = !zikr;
  const isCustom = isNew || !!zikr?.is_custom;
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [target, setTarget] = useState('100');
  const [icon, setIcon] = useState<IconName>('star-four-points-outline');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(zikr?.title ?? '');
    setText(zikr?.text ?? '');
    setTarget(String(zikr?.target ?? 33));
    setIcon((zikr?.icon as IconName) ?? 'star-four-points-outline');
    setError(null);
    setConfirmDelete(false);
  }, [visible, zikr]);

  const n = parseInt(target, 10);
  const valid = title.trim().length > 0 && n >= 1 && n <= 100000;

  const act = async (fn: () => Promise<unknown>, deletedId?: number) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved(deletedId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    act(() =>
      isNew
        ? api.createZikr({ title: title.trim(), text, icon, target: n })
        : api.updateZikr(zikr!.id, isCustom ? { title: title.trim(), text, icon, target: n } : { title: title.trim(), text, target: n }),
    );

  const inputStyle = [s.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <View style={s.head}>
            <View style={[s.headIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name={isNew ? 'plus' : 'pencil-outline'} size={20} color={colors.primary} />
            </View>
            <Text style={[s.title, { color: colors.text }]}>{isNew ? 'Yangi zikr' : 'Zikrni tahrirlash'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {!isNew && !isCustom && (
            <Text style={[s.note, { color: colors.textMuted }]}>
              Bu umumiy zikr. O'zgarishlaringiz faqat sizda saqlanadi.
            </Text>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={[s.label, { color: colors.text }]}>Nomi</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Masalan: Subhanalloh" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={200} />

            <Text style={[s.label, { color: colors.text }]}>O'zbekcha o'qilishi va ma'nosi</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={"Subhanalloh.\nMa'nosi: Alloh pokdir."}
              placeholderTextColor={colors.textMuted}
              style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]}
            />

            <Text style={[s.label, { color: colors.text }]}>Kunlik maqsad (necha marta)</Text>
            <View style={s.targetRow}>
              <TextInput
                value={target}
                onChangeText={(v) => setTarget(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={[inputStyle, { flex: 1, flexBasis: 0, minWidth: 60 }]}
                maxLength={6}
              />
              {[33, 100, 1000].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setTarget(String(v))}
                  style={[s.quick, { borderColor: n === v ? colors.primary : colors.border, backgroundColor: n === v ? colors.primarySoft : 'transparent' }]}
                >
                  <Text style={{ color: n === v ? colors.primary : colors.text, fontWeight: '700' }}>{v}</Text>
                </Pressable>
              ))}
            </View>

            {isCustom && (
              <>
                <Text style={[s.label, { color: colors.text, marginTop: 12 }]}>Belgi</Text>
                <View style={s.icons}>
                  {ZIKR_ICONS.map((ic) => {
                    const active = ic === icon;
                    return (
                      <Pressable
                        key={ic}
                        onPress={() => setIcon(ic)}
                        style={[s.iconBtn, { backgroundColor: active ? colors.primary : colors.bg, borderColor: active ? colors.primary : colors.border }]}
                      >
                        <Icon name={ic} size={20} color={active ? colors.primaryText : colors.primary} />
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}

          <View style={{ marginTop: 14, gap: 8 }}>
            <Button title={isNew ? "Qo'shish" : 'Saqlash'} icon="check" onPress={save} disabled={!valid || busy} />
            {!isNew && zikr!.edited && !isCustom && (
              <Button title="Asl holiga qaytarish" icon="restore" variant="ghost" onPress={() => act(() => api.resetZikr(zikr!.id))} disabled={busy} />
            )}
            {!isNew && (
              <Pressable
                disabled={busy}
                onPress={() => (confirmDelete ? act(() => api.deleteZikr(zikr!.id), zikr!.id) : setConfirmDelete(true))}
                style={[s.delete, { borderColor: confirmDelete ? colors.danger : colors.border, backgroundColor: confirmDelete ? colors.danger + '14' : 'transparent' }]}
              >
                <Icon name={isCustom ? 'delete-outline' : 'eye-off-outline'} size={18} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: '700' }}>
                  {confirmDelete
                    ? 'Tasdiqlash uchun yana bosing'
                    : isCustom
                      ? "Zikrni o'chirish"
                      : "Ro'yxatimdan olib tashlash"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, paddingTop: 10, maxHeight: '92%' },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 19, fontWeight: '800' },
  note: { fontSize: 13, marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  targetRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  quick: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
});
