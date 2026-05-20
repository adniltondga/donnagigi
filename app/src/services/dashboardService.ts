import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type {
  Bill,
  CashPools,
  DashboardSummary,
  MLClaimsListResponse,
  MLReturnsListResponse,
  Paginated,
  RelatorioV2Response,
} from '@/types';

function todayBR(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysBR(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const dashboardService = {
  async summary(): Promise<
    | { success: true; data: DashboardSummary }
    | { success: false; error: string }
  > {
    const hoje = todayBR();
    const em7dias = addDaysBR(7);

    const [kpisRes, contasRes, caixaRes, claimsRes, returnsRes] =
      await Promise.all([
        apiCall<RelatorioV2Response>(() =>
          apiClient.get(API_CONFIG.ENDPOINTS.RELATORIOS.V2, {
            params: { from: hoje, to: hoje },
          }),
        ),
        apiCall<Paginated<Bill>>(() =>
          apiClient.get(API_CONFIG.ENDPOINTS.BILLS.LIST, {
            params: {
              type: 'payable',
              status: 'pending',
              dueFrom: hoje,
              dueTo: em7dias,
              orderBy: 'dueDate_asc',
              excludeAportes: true,
              limit: 5,
            },
          }),
        ),
        apiCall<CashPools>(() =>
          apiClient.get(API_CONFIG.ENDPOINTS.FINANCEIRO.CASH_POOLS),
        ),
        apiCall<MLClaimsListResponse>(() =>
          // Sem enrich aqui — só precisamos do paging.total. Enrich custaria
          // N+1 requests ao ML pra um número que a gente vai jogar fora.
          apiClient.get(API_CONFIG.ENDPOINTS.ML.CLAIMS_LIST, {
            params: { status: 'opened', limit: 1 },
          }),
        ),
        apiCall<MLReturnsListResponse>(() =>
          // Returns precisa da listagem inteira pra contar (não tem
          // count separado). Backend lida com o paralelismo.
          apiClient.get(API_CONFIG.ENDPOINTS.ML.RETURNS_LIST),
        ),
      ]);

    if (!kpisRes.success) return { success: false, error: kpisRes.error };
    if (!contasRes.success) return { success: false, error: contasRes.error };

    const k = kpisRes.data.kpisAtual;
    const vendasHoje = {
      pedidos: k.pedidos,
      bruto: k.bruto,
      lucro: k.lucro,
    };

    const contasBills = contasRes.data.data;
    const contasVencendo = {
      count: contasRes.data.total,
      total: contasBills.reduce((sum, b) => sum + b.amount, 0),
      bills: contasBills,
    };

    const mlClaims =
      claimsRes.success && claimsRes.data.paging.total > 0
        ? { count: claimsRes.data.paging.total }
        : null;

    const mlReturns =
      returnsRes.success && returnsRes.data.total > 0
        ? { count: returnsRes.data.total }
        : null;

    return {
      success: true,
      data: {
        vendasHoje,
        contasVencendo,
        caixa: caixaRes.success ? caixaRes.data : null,
        mlClaims,
        mlReturns,
      },
    };
  },
};
