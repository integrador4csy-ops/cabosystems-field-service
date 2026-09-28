import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SignUpScreen() {
  const router = useRouter();

  useEffect(() => {
    // El registro de cuentas en CaboSystems se realiza automáticamente mediante Google
    router.replace('/(auth)');
  }, [router]);

  return null;
}
