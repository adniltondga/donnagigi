import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';

export interface WaitlistResponse {
  ok: boolean;
  alreadyRegistered?: boolean;
}

export const waitlistService = {
  subscribe: (email: string) =>
    apiCall<WaitlistResponse>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.WAITLIST, {
        email: email.trim().toLowerCase(),
        source: 'mobile',
      }),
    ),
};
