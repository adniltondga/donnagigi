import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';

export const mlAdsService = {
  toggleItem: (mlListingId: string) =>
    apiCall<{ ok: boolean; status: 'active' | 'paused' }>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.ML.TOGGLE_ITEM(mlListingId)),
    ),
};
