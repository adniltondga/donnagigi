import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type {
  Bill,
  CashPools,
  DashboardSummary,
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

    const [kpisRes, contasRes, caixaRes] = await Promise.all([
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

    return {
      success: true,
      data: {
        vendasHoje,
        contasVencendo,
        caixa: caixaRes.success ? caixaRes.data : null,
      },
    };
  },
};
