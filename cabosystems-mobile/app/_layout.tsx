import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ProjectsProvider } from '@/lib/projects';
import { LanguageProvider } from '@/lib/i18n';
import { startLiveTracking, stopLiveTracking, subscribeToBackgroundLocationPrompt } from '@/lib/liveTrackingService';
import BackgroundLocationModal from '@/components/BackgroundLocationModal';
import { useAppUpdateCheck } from '@/lib/appUpdateService';
import AppUpdateModal from '@/components/AppUpdateModal';
import { registerForPushNotificationsAsync, setupNotificationResponseListener } from '@/lib/notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { startFieldSync } from '@/lib/fieldSync';
import { FieldSyncStatus } from '@/components/FieldSyncStatus';
import { startAgendaWindow } from '@/lib/agendaWindowService';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const agendaOwner = profile?.activo && profile.id === session?.user.id ? profile.id : '';
  useEffect(() => agendaOwner ? startAgendaWindow(agendaOwner, false) : undefined, [agendaOwner]);
  useEffect(() => session?.user.id ? startFieldSync(session.user.id) : undefined, [session?.user.id]);
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [showBgLocationModal, setShowBgLocationModal] = useState(false);
  const { updateInfo, modalVisible: showUpdateModal, dismissModal: closeUpdateModal } = useAppUpdateCheck();

  // Suscripción al disparador controlado del modal de permisos en segundo plano
  useEffect(() => {
    const unsubscribe = subscribeToBackgroundLocationPrompt(() => {
      setShowBgLocationModal(true);
    });
    return () => unsubscribe();
  }, []);

  // Iniciar rastreo continuo adaptativo tipo Life360 cuando el usuario esté conectado
  useEffect(() => {
    if (session?.user?.id) {
      startLiveTracking(session.user.id);
    } else {
      stopLiveTracking();
    }
  }, [session?.user?.id]);

  // Registrar Expo Push Token y sincronizarlo con Supabase
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);
    }
  }, [session?.user?.id]);

  // Escuchar cuando el usuario toca una notificación push (app en segundo plano / pantalla bloqueada)
  useEffect(() => {
    const unsubscribe = setupNotificationResponseListener((path) => {
      try {
        router.push(path as any);
      } catch (e) {
        console.warn('Error navegando desde notificación push:', e);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Interceptar enlaces de invitación y enrutar directamente a Registro o Recuperación
  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) return;
      try {
        let extractedToken = '';
        let extractedEmail = '';
        let isRecovery = url.includes('reset-password') || url.includes('type=recovery') || url.includes('recovery');
        let recoveryAccessToken = '';
        let recoveryRefreshToken = '';
        let recoveryCode = '';

        if (url.includes('?')) {
          const query = url.split('?')[1].split('#')[0];
          const sp = new URLSearchParams(query);
          extractedToken = sp.get('token') || '';
          extractedEmail = sp.get('email') || '';
          recoveryCode = sp.get('code') || '';
          if (sp.get('type') === 'recovery' || sp.get('mode') === 'recovery') isRecovery = true;
          if (sp.get('access_token')) recoveryAccessToken = sp.get('access_token') || '';
          if (sp.get('refresh_token')) recoveryRefreshToken = sp.get('refresh_token') || '';
        }

        if (url.includes('#')) {
          const hash = url.split('#')[1];
          const hp = new URLSearchParams(hash);
          extractedToken = extractedToken || hp.get('token') || '';
          extractedEmail = extractedEmail || hp.get('email') || '';
          recoveryAccessToken = recoveryAccessToken || hp.get('access_token') || '';
          recoveryRefreshToken = recoveryRefreshToken || hp.get('refresh_token') || '';
          recoveryCode = recoveryCode || hp.get('code') || '';
          if (hp.get('type') === 'recovery') isRecovery = true;
        }

        if (extractedToken || url.includes('register')) {
          router.replace({
            pathname: '/(auth)/register',
            params: { token: extractedToken, email: extractedEmail },
          });
        } else if (isRecovery) {
          router.replace({
            pathname: '/(auth)/reset-password',
            params: {
              mode: 'recovery',
              access_token: recoveryAccessToken,
              refresh_token: recoveryRefreshToken,
              code: recoveryCode,
              email: extractedEmail,
            },
          });
        }
      } catch (e) {
        console.warn('Error al procesar deep link en RootLayoutNav:', e);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    // Evitar navegación si el árbol de navegación no se ha montado aún o auth está cargando
    if (!rootNavigationState?.key || loading) return;

    void SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === '(auth)';
    const isResettingPassword = segments[1] === 'reset-password';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)');
    } else if (session && !isResettingPassword && (inAuthGroup || segments[0] === 'pending')) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, rootNavigationState?.key, router]);

  if (loading) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, freezeOnBlur: true }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pending" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkin/[id]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/new-group" options={{ headerShown: false }} />
        <Stack.Screen name="chat/group-info/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <FieldSyncStatus owner={session?.user.id || ''} />
      <BackgroundLocationModal
        visible={showBgLocationModal}
        onClose={() => setShowBgLocationModal(false)}
      />
      <AppUpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={closeUpdateModal}
      />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    // Compatibilidad universal para cualquier referencia previa
    Montserrat_400Regular: Outfit_400Regular,
    Montserrat_500Medium: Outfit_500Medium,
    Montserrat_600SemiBold: Outfit_600SemiBold,
    Montserrat_700Bold: Outfit_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Fallback de seguridad en caso de que la navegación demore en resolver
      const timer = setTimeout(() => {
        void SplashScreen.hideAsync().catch(() => {});
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}><LanguageProvider>
      <AuthProvider>
        <ProjectsProvider>
          <RootLayoutNav />
        </ProjectsProvider>
      </AuthProvider>
    </LanguageProvider></GestureHandlerRootView>
  );
}
