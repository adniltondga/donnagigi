import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { Bill, BillStatus, BillType, Paginated } from '@/types';

export interface BillListParams {
  type?: BillType;
  status?: BillStatus;
  page?: number;
  limit?: number;
  q?: string;
  dueFrom?: string;
  dueTo?: string;
  paidFrom?: string;
  paidTo?: string;
  orderBy?: string;
  excludeAportes?: boolean;
}

export interface CreateBillInput {
  type: BillType;
  description: string;
  amount: number;
  dueDate: string;
  category?: string;
  notes?: string;
}

export interface UpdateBillInput {
  description?: string;
  amount?: number;
  dueDate?: string;
  category?: string;
  notes?: string | null;
  status?: BillStatus;
  type?: BillType;
}

export const billsService = {
  list: (params: BillListParams = {}) =>
    apiCall<Paginated<Bill>>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.BILLS.LIST, { params }),
    ),

  create: (input: CreateBillInput) =>
    apiCall<Bill>(() =>
      apiClient.post(API_CONFIG.ENDPOINTS.BILLS.LIST, input),
    ),

  markPaid: (id: string) =>
    apiCall<Bill>(() => apiClient.patch(API_CONFIG.ENDPOINTS.BILLS.PAY(id))),

  update: (id: string, input: UpdateBillInput) =>
    apiCall<Bill>(() =>
      apiClient.put(API_CONFIG.ENDPOINTS.BILLS.DETAIL(id), input),
    ),

  remove: (id: string) =>
    apiCall<{ success: boolean; deleted: number }>(() =>
      apiClient.delete(API_CONFIG.ENDPOINTS.BILLS.DETAIL(id)),
    ),

  detail: (id: string) =>
    apiCall<Bill>(() => apiClient.get(API_CONFIG.ENDPOINTS.BILLS.DETAIL(id))),
};
