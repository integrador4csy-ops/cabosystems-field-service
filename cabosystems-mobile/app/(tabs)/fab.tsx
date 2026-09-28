import { useEffect } from 'react';
import { router } from 'expo-router';

export default function FabScreen() {
  useEffect(() => {
    router.replace('/checkin/new' as any);
  }, []);

  return null;
}
