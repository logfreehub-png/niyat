import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Button, Card, SectionTitle } from './ui';

/** Rasmni tanlab, 256 px kvadratga kichraytirib, data URI qilib qaytaradi. */
async function pickAvatar(): Promise<string | null> {
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets?.length) return null;
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const out = await manipulateAsync(res.assets[0].uri, [{ resize: { width: 256, height: 256 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

export function Avatar({ uri, name, size = 72 }: { uri?: string; name?: string; size?: number }) {
  const { colors } = useTheme();
  const letter = (name || '').trim().charAt(0).toUpperCase();
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      {letter ? (
        <Text style={{ color: colors.primary, fontSize: size * 0.42, fontWeight: '800' }}>{letter}</Text>
      ) : (
        <Icon name="account" size={size * 0.55} color={colors.primary} />
      )}
    </View>
  );
}

/** Profil: ism va (ixtiyoriy) rasm. */
export function ProfileCard() {
  const { colors } = useTheme();
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState<'name' | 'photo' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setName(user?.name ?? ''), [user?.name]);

  const save = async (data: { name?: string; avatar?: string }, kind: 'name' | 'photo') => {
    setBusy(kind);
    setMsg(null);
    try {
      setUser(await api.updateProfile(data));
      setMsg(kind === 'name' ? 'Ism saqlandi' : data.avatar ? 'Rasm saqlandi' : "Rasm o'chirildi");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const choosePhoto = async () => {
    if (Platform.OS === 'web') return setMsg("Rasm yuklash telefonda ishlaydi");
    try {
      const uri = await pickAvatar();
      if (uri) await save({ avatar: uri }, 'photo');
    } catch {
      setMsg("Rasmni ochib bo'lmadi");
    }
  };

  const dirty = name.trim() !== (user?.name ?? '');

  return (
    <Card>
      <SectionTitle icon="account-circle-outline">Profil</SectionTitle>
      <View style={s.row}>
        <Pressable onPress={choosePhoto} accessibilityLabel="Profil rasmini tanlash" style={s.avatarWrap}>
          <Avatar uri={user?.avatar} name={name || user?.name} size={76} />
          <View style={[s.camera, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
            {busy === 'photo' ? <ActivityIndicator size="small" color={colors.primaryText} /> : <Icon name="camera" size={14} color={colors.primaryText} />}
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {user?.name || 'Ismingizni kiriting'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{user?.phone || '—'}</Text>
          {user?.avatar ? (
            <Pressable onPress={() => save({ avatar: '' }, 'photo')} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 6 }}>Rasmni o'chirish</Text>
            </Pressable>
          ) : (
            <Pressable onPress={choosePhoto} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 6 }}>+ Rasm yuklash (ixtiyoriy)</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={[s.label, { color: colors.text }]}>Ismingiz</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Masalan: Muhammad"
        placeholderTextColor={colors.textMuted}
        maxLength={100}
        returnKeyType="done"
        onSubmitEditing={() => dirty && save({ name }, 'name')}
        style={[s.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
      />
      {dirty && <Button title="Ismni saqlash" icon="check" onPress={() => save({ name }, 'name')} loading={busy === 'name'} />}
      {msg && <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>{msg}</Text>}
      <View style={{ height: 12 }} />
      <Button title="Chiqish" icon="logout" variant="ghost" onPress={logout} />
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  avatarWrap: { position: 'relative' },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginBottom: 10 },
});
