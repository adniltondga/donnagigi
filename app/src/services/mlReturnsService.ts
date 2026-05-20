import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { MLReturnsListResponse } from '@/types';

export const mlReturnsService = {
  list: (limit = 50) =>
    apiCall<MLReturnsListResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.ML.RETURNS_LIST, {
        params: { limit },
      }),
    ),
};
