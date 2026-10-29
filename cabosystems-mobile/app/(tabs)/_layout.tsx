import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import {
  ClipboardList,
  Calendar,
  Camera,
  MessageSquare,
  Users,
} from 'lucide-react-native';
import { Tabs, useRouter, useSegments, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Animation } from '@/constants/Theme';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { getLatestOfflineFieldRecord as getLatestFieldRecord, subscribeFieldSync } from '@/lib/fieldSync';
import { startForegroundPolling } from '@/lib/foregroundPolling';
import { useTranslation } from '@/lib/i18n';
import { afterTabPaint, prepareTabs } from '@/lib/tabPreparation';
import { TabStartupProvider, useTabStartup } from '@/lib/tabStartup';
import { preloadMyChatGroups } from '@/lib/chatApi';
import { preloadAgendaData } from '@/lib/agendaWindowService';
import { preloadUsersData } from './users';
import { ConnectedTabBarProvider, ConnectedTabBackground, ConnectedTabButton, ConnectedTabIcon, ConnectedTabLabel } from '@/components/ConnectedTabBar';

export const unstable_settings = { anchor: 'index' };

const renderTabBarBackground = () => <ConnectedTabBackground />;

const TabBarIcon = React.memo(function TabBarIcon({
  Icon,
  color,
  focused,
  tab,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: any;
  focused: boolean;
  tab: string;
}) {
  return (
    <ConnectedTabIcon tab={tab} Icon={Icon} />
  );
});

const renderTabButton = (props: any) => {
  return <ConnectedTabButton {...props} />;
};

const TasksLabel = ({ children }: any) => <ConnectedTabLabel tab="index">{children}</ConnectedTabLabel>;
const ScheduleLabel = ({ children }: any) => <ConnectedTabLabel tab="schedule">{children}</ConnectedTabLabel>;
const UsersLabel = ({ children }: any) => <ConnectedTabLabel tab="users">{children}</ConnectedTabLabel>;
const ChatLabel = ({ children }: any) => <ConnectedTabLabel tab="chat">{children}</ConnectedTabLabel>;

const renderTabBarLabel = ({ color, children, focused }: any) => (
  <Text
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.85}
    style={[styles.tabLabel, { color }, focused && styles.tabLabelActive]}
  >
    {children}
  </Text>
);

// Keep one opaque surface with no focus listeners or scene animation work.
const renderScreenLayout = ({ children }: { children: React.ReactNode }) => (
  <View collapsable={false} style={styles.scene}>{children}</View>
);

const TasksIcon = ({ color, focused }: { color: any; focused: boolean }) => (
  <TabBarIcon tab="index" Icon={ClipboardList} color={color} focused={focused} />
);
const ScheduleIcon = ({ color, focused }: { color: any; focused: boolean }) => (
  <TabBarIcon tab="schedule" Icon={Calendar} color={color} focused={focused} />
);
const UsersIcon = ({ color, focused }: { color: any; focused: boolean }) => (
  <TabBarIcon tab="users" Icon={Users} color={color} focused={focused} />
);
const ChatIcon = ({ color, focused }: { color: any; focused: boolean }) => (
  <TabBarIcon tab="chat" Icon={MessageSquare} color={color} focused={focused} />
);

function FloatingActionButton(props: any) {
  const focused = props['aria-selected'] === true || props.accessibilityState?.selected === true;
  const iconColor = focused ? '#FFFFFF' : 'rgba(0,0,0,0.58)';
  const router = useRouter();
  const { user } = useAuth();
  const { selectedProject } = useProjects();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  useEffect(() => {
    let mounted = true;
    setIsCheckedIn(false);
    if (!user?.id) return;
    async function checkStatus() {
      if (!user?.id) return;
      const latest = await getLatestFieldRecord(user.id);
      if (mounted) {
        setIsCheckedIn(latest?.tipo === 'check_in');
      }
    }
    const stopPolling = startForegroundPolling(checkStatus, 10000);
    const unsubscribe = subscribeFieldSync(() => {
      void checkStatus().catch(() => {});
    });
    return () => {
      mounted = false;
      stopPolling();
      unsubscribe();
    };
  }, [user?.id]);

  return (
    <View style={[props?.style, styles.fabWrapper]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.checkinCheckout')}
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [
          styles.fab,
          isHovered && styles.fabHovered,
          pressed && { opacity: 0.85, transform: [{ scale: Animation.pressScale }] },
        ]}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        onPress={() => {
          const targetId = selectedProject?.id || 'villa';
          const checkType = isCheckedIn ? 'check_out' : 'check_in';
          router.navigate({ pathname: '/(tabs)/fab', params: { id: targetId, type: checkType } });
        }}
      >
        <ConnectedTabIcon tab="fab" Icon={Camera} size={23} />
        <ConnectedTabLabel tab="fab">{t('nav.checkins')}</ConnectedTabLabel>
        {isCheckedIn && <View style={styles.fabActiveBadge} />}
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const { profile } = useAuth();
  return <TabStartupProvider key={profile?.id || 'anonymous'}><PreparedTabLayout /></TabStartupProvider>;
}

function PreparedTabLayout() {
  const { mainReady, markMainReady } = useTabStartup();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const isAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';
  const tabOrder = useMemo(() => isAdmin ? ['index', 'schedule', 'users', 'chat'] : ['fab', 'index', 'schedule', 'chat'], [isAdmin]);

  const currentTab = segments[1] || (
    pathname.includes('schedule') ? 'schedule' :
    pathname.includes('chat') ? 'chat' :
    pathname.includes('users') ? 'users' :
    pathname.includes('fab') ? 'fab' :
    'index'
  );


  useEffect(() => {
    if (!mainReady && currentTab !== 'index') return afterTabPaint(markMainReady);
  }, [mainReady, currentTab, markMainReady]);

  useEffect(() => {
    if (!mainReady || !profile?.activo || !profile.id) return;
    const owner = profile.id;
    let cancelled = false;
    const stop = prepareTabs([
      async () => { await preloadAgendaData(owner); if (!cancelled) router.prefetch('/(tabs)/schedule'); },
      async () => { await preloadMyChatGroups(owner); if (!cancelled) router.prefetch('/(tabs)/chat'); },
      async () => { if (isAdmin) { await preloadUsersData(owner); if (!cancelled) router.prefetch('/(tabs)/users'); } },
      () => { router.prefetch('/(tabs)/profile'); },
      () => { if (!isAdmin) router.prefetch('/(tabs)/fab'); },
    ], 2);
    return () => { cancelled = true; stop(); };
  }, [mainReady, profile?.id, profile?.activo, isAdmin, router]);
  const bottomInset = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET);

  const tabBarStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      start: 16,
      end: 16,
      marginHorizontal: 0,
      bottom: bottomInset,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      borderRadius: 36,
      height: BOTTOM_BAR_HEIGHT,
      paddingTop: 6,
      paddingBottom: 6,
      paddingHorizontal: 6,
      overflow: 'visible' as const,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    }),
    [bottomInset]
  );

  return (
    <ConnectedTabBarProvider tabs={tabOrder} activeTab={currentTab}>
      <View style={styles.scene}>
        <Tabs
        backBehavior="initialRoute"
        detachInactiveScreens
        screenLayout={renderScreenLayout}
        screenOptions={{
          lazy: true,
          animation: 'none',
          sceneStyle: styles.scene,
          tabBarActiveTintColor: '#FFFFFF',
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveTintColor: 'rgba(0,0,0,0.58)',
          tabBarLabelPosition: 'below-icon',
          tabBarButton: renderTabButton,
          tabBarLabel: renderTabBarLabel,
          tabBarBackground: renderTabBarBackground,
          tabBarStyle,
          tabBarItemStyle: styles.tabBarItem,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="fab"
          options={
            isAdmin
              ? { href: null }
              : {
                  title: t('nav.checkins'),
                  tabBarButton: props => <FloatingActionButton {...props} />,
                }
          }
        />
        <Tabs.Screen
          name="index"
          activityEnabled={false}
          options={{
            title: t('nav.tasks'),
            tabBarIcon: TasksIcon,
            tabBarLabel: TasksLabel,
          }}
        />
        <Tabs.Screen
          name="schedule"
          activityEnabled={false}
          options={{
            title: t('nav.schedule'),
            tabBarIcon: ScheduleIcon,
            tabBarLabel: ScheduleLabel,
          }}
        />
        <Tabs.Screen
          name="users"
          activityEnabled={!isAdmin}
          options={{
            title: t('nav.team'),
            tabBarIcon: UsersIcon,
            tabBarLabel: UsersLabel,
            href: isAdmin ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="chat"
          activityEnabled={false}
          options={{
            title: t('nav.chat'),
            tabBarIcon: ChatIcon,
            tabBarLabel: ChatLabel,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('nav.profile'),
            lazy: true,
            tabBarItemStyle: { display: 'none' },
            tabBarButton: () => null,
          }}
        />
      </Tabs>
    </View>
    </ConnectedTabBarProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scene: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  slidingSelection: {
    position: 'absolute',
    left: 8,
    top: 6,
    bottom: 6,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.40)',
    backgroundColor: 'transparent',
  },
  barTint: { backgroundColor: '#FFFFFF' },
  tabLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginTop: 2,
    paddingHorizontal: 0,
  },
  tabLabelActive: {
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
  },
  tabButton: {
    flex: 1,
    borderRadius: 30,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
    zIndex: 1,
    elevation: 1,
  },
  tabBarItem: {
    borderRadius: 30,
    overflow: 'visible',
    paddingVertical: 0,
    marginHorizontal: 2,
  },
  iconPill: {
    width: 24,
    height: 24,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrapper: {
    flex: 1,
    padding: 0,
    borderRadius: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'visible',
  },
  fab: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabHovered: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  fabActiveBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#343e48',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
