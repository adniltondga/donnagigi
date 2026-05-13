import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type {
  Bill,
  CashPools,
  DashboardSummary,
  Paginated,
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

    const [vendasRes, contasRes, caixaRes] = await Promise.all([
      apiCall<Paginated<Bill>>(() =>
        apiClient.get(API_CONFIG.ENDPOINTS.BILLS.LIST, {
          params: {
            type: 'receivable',
            category: 'venda',
            paidFrom: hoje,
            paidTo: hoje,
            limit: 100,
          },
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

    if (!vendasRes.success) return { success: false, error: vendasRes.error };
    if (!contasRes.success) return { success: false, error: contasRes.error };

    const vendasBills = vendasRes.data.data;
    const vendasHoje = {
      count: vendasBills.length,
      total: vendasBills.reduce(
        (sum, b) => sum + Math.max(0, b.amount - (b.refundedAmount ?? 0)),
        0,
      ),
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
