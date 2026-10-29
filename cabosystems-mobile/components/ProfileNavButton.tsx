import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

export function ProfileNavButton() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [failedUrl, setFailedUrl] = useState<string>();
  const avatar = profile?.avatar_url;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('nav.profile')}
    onPress={() => router.navigate('/(tabs)/profile')}
    style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
    {avatar && avatar !== failedUrl
      ? <Image source={{ uri: avatar }} style={styles.photo} contentFit="cover" onError={() => setFailedUrl(avatar)} />
      : <User size={22} color="#343e48" />}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, flexShrink: 0, marginLeft: 8, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
  photo: { width: 38, height: 38, borderRadius: 19 },
});
