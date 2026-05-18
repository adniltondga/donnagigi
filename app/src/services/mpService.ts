import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { MPSnapshot } from '@/types';

export const mpService = {
  snapshot: () =>
    apiCall<MPSnapshot>(() => apiClient.get(API_CONFIG.ENDPOINTS.MP.SNAPSHOT)),
};
