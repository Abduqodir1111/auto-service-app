import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';

export default function Index() {
  const session = useAuthStore((state) => state.session);

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}
