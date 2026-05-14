import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { RelatorioV2Response } from '@/types';

export const relatoriosService = {
  /**
   * KPIs agregados de vendas no período (mesmo cálculo do web admin).
   * Datas em YYYY-MM-DD. Pra "hoje" passar a mesma data em ambos.
   */
  v2: (from: string, to: string) =>
    apiCall<RelatorioV2Response>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.RELATORIOS.V2, {
        params: { from, to },
      }),
    ),
};
