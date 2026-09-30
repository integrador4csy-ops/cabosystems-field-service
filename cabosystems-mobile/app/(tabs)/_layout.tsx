import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ClipboardList,
  Calendar,
  Camera,
  MessageSquare,
  Users,
  User,
} from 'lucide-react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Glass, Shadow, Animation } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { getLatestFieldRecord } from '@/lib/api';

const FAB_SIZE = 52;

function TabBarIcon({
  Icon,
  color,
  focused,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: any;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Icon
        size={21}
        color={focused ? Colors.primary : Colors.textSecondary}
        strokeWidth={focused ? 2.4 : 1.9}
      />
    </View>
  );
}

function FloatingActionButton(props: any) {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedProject } = useProjects();
  const [isHovered, setIsHovered] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      if (!user?.id) return;
      const latest = await getLatestFieldRecord(user.id);
      if (mounted) {
        setIsCheckedIn(latest?.tipo === 'check_in');
      }
    }
    checkStatus();
    const timer = setInterval(checkStatus, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user?.id]);

  return (
    <View style={[styles.fabWrapper, props?.style]}>
      <View style={styles.fabAlignBox}>
        <Pressable
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
            router.push(`/checkin/${targetId}?type=${checkType}` as any);
          }}
        >
          <Camera size={23} color={Colors.textWhite} strokeWidth={2.4} />
          {isCheckedIn && <View style={styles.fabActiveBadge} />}
        </Pressable>
      </View>
      <View style={styles.fabSpacer} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  // Garantizar margen inferior seguro para pantallas con esquinas redondeadas o gestos
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E4E7EC',
          borderTopWidth: 1,
          height: 66 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          paddingHorizontal: 8,
          overflow: 'visible',
          ...Shadow.md,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontFamily: 'Outfit_600SemiBold',
          fontSize: 11,
          marginTop: 3,
          letterSpacing: 0.15,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tareas',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={ClipboardList} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Calendar} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fab"
        options={
          isAdmin
            ? { href: null }
            : {
                title: '',
                tabBarButton: (props) => <FloatingActionButton {...props} />,
              }
        }
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Equipo',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Users} color={color} focused={focused} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={MessageSquare} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={User} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: Colors.primaryLight,
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'visible',
  },
  fabAlignBox: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.primary,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  fabHovered: {
    transform: [{ scale: 1.08 }],
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  fabActiveBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fabSpacer: {
    height: 12,
    marginTop: 2,
  },
});
