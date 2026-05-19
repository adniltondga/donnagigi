import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type {
  MLClaimDetailResponse,
  MLClaimMessage,
  MLClaimsListResponse,
} from '@/types';

type ListParams = {
  status?: 'opened' | 'closed';
  limit?: number;
  offset?: number;
  /** Default true: o backend enriquece com lastMessageRole/needsResponse. */
  enrich?: boolean;
};

export const mlClaimsService = {
  list: ({ enrich = true, ...params }: ListParams = {}) =>
    apiCall<MLClaimsListResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.ML.CLAIMS_LIST, {
        params: {
          ...params,
          ...(enrich ? { enrich: 'last_message' } : {}),
        },
      }),
    ),

  detail: (id: string | number) =>
    apiCall<MLClaimDetailResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.ML.CLAIM_DETAIL(id)),
    ),

  sendMessage: (id: string | number, message: string) =>
    apiCall<MLClaimMessage>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.ML.CLAIM_MESSAGES(id), { message }),
    ),
};
