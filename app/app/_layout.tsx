import { useEffect } from 'react';
import { Slot, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { AuthProvider, ThemeProvider } from '@/contexts';
import { backendLinkToAppRoute } from '@/utils/deeplink';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Deep-linking: quando o user toca numa push notification (foreground
  // ou abrindo do tray), navega pra rota mapeada se houver `data.link`.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { link?: string }
          | undefined;
        const route = backendLinkToAppRoute(data?.link);
        if (route) {
          router.push(route);
        }
      },
    );
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Slot />
          <Toast />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
