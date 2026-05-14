import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient, apiCall } from './api';
import { API_CONFIG, STORAGE_KEYS } from '@/constants';
import { secureStorage } from '@/utils/storage';

/**
 * Push notifications via Expo Push Service.
 *
 * Fluxo:
 *  1. `register()` pede permissão, pega o ExponentPushToken e manda
 *     pro back (/api/push/expo/subscribe). Token persistido em
 *     SecureStore pra unsubscribe no logout.
 *  2. Quando uma notification in-app é criada no back, ele dispara
 *     push via Expo Push Service pro device.
 *  3. `unregister()` deleta o token no back. Chamado no logout.
 *
 * Simulador não recebe push real — só dispositivo físico.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'AgLivre',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6d28d9',
  });
}

async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const projectId =
      // expo-constants resolve isso em runtime; mantemos opcional pra
      // desenvolvimento (sem EAS project), aí o getExpoPushToken usa
      // a chave do dev mesmo.
      undefined;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

export const pushService = {
  /**
   * Pede permissão, obtém token Expo e registra no back. Retorna
   * `false` se permissão negada, sem device físico, ou falha de rede.
   */
  async register(): Promise<boolean> {
    await ensureAndroidChannel();

    const granted = await requestPermissions();
    if (!granted) return false;

    const token = await getExpoPushToken();
    if (!token) return false;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = Device.deviceName ?? null;

    const res = await apiCall<{ ok: boolean }>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.PUSH.EXPO_SUBSCRIBE, {
        token,
        platform,
        deviceName,
      }),
    );

    if (!res.success) return false;

    await secureStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
    return true;
  },

  /**
   * Remove o token registrado no back. Idempotente.
   */
  async unregister(): Promise<void> {
    const token = await secureStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    if (!token) return;

    await apiCall<{ ok: boolean }>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.PUSH.EXPO_UNSUBSCRIBE, { token }),
    );
    await secureStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
  },

  /**
   * Limpa o badge do ícone (chamar quando user abre lista de
   * notificações).
   */
  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch {
      // no-op
    }
  },
};
