import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, ArrowRight } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';

export default function PendingScreen() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirigir de inmediato al panel de operaciones para cuentas autorizadas
    router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <ShieldCheck size={50} color={Colors.primary} strokeWidth={2.2} />
        </View>

        <Text style={styles.title}>Acceso Autorizado</Text>
        <Text style={styles.subtitle}>
          Tu cuenta de CaboSystems está activa. Redirigiendo a tu panel de tareas...
        </Text>

        <Pressable
          style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.88 }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.continueText}>Entrar a Tareas</Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
  },
  continueText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
