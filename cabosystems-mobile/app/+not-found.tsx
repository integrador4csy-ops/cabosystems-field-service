import { useTranslation } from '@/lib/i18n';
﻿import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('Página no encontrada') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('Esta pantalla no existe.')}</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('Ir a la pantalla de inicio')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#f78c26',
  },
});

