import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { CashPools } from '@/types';

export const cashPoolService = {
  current: () =>
    apiCall<CashPools>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.FINANCEIRO.CASH_POOLS),
    ),

  // end é opcional: sem ele, o backend usa "agora" como fim do período
  // (igual ao painel web, que chama /cash-pools?start=... sem end).
  range: (start: string, end?: string) =>
    apiCall<CashPools>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.FINANCEIRO.CASH_POOLS, {
        params: end ? { start, end } : { start },
      }),
    ),
};
