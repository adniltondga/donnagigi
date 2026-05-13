import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { NotificationsResponse } from '@/types';

export const notificationService = {
  list: () =>
    apiCall<NotificationsResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.NOTIFICATIONS.LIST),
    ),

  markAllRead: () =>
    apiCall<{ ok: boolean }>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.NOTIFICATIONS.READ_ALL),
    ),

  markRead: (id: string) =>
    apiCall<{ ok: boolean }>(() =>
      apiClient.patch(API_CONFIG.ENDPOINTS.NOTIFICATIONS.READ_ONE(id)),
    ),
};
