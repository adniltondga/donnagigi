import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { CashPools } from '@/types';

export const cashPoolService = {
  current: () =>
    apiCall<CashPools>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.FINANCEIRO.CASH_POOLS),
    ),

  range: (start: string, end: string) =>
    apiCall<CashPools>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.FINANCEIRO.CASH_POOLS, {
        params: { start, end },
      }),
    ),
};
