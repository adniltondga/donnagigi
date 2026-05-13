import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';
import type { Product, ProductsResponse } from '@/types';

export const productsService = {
  search: (search: string, page = 1, limit = 20) =>
    apiCall<ProductsResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.PRODUCTS.LIST, {
        params: { search, page, limit },
      }),
    ),

  list: (page = 1, limit = 20) =>
    apiCall<ProductsResponse>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.PRODUCTS.LIST, {
        params: { page, limit },
      }),
    ),

  detail: async (id: string) => {
    const res = await apiCall<{ success: boolean; data: Product }>(() =>
      apiClient.get(API_CONFIG.ENDPOINTS.PRODUCTS.DETAIL(id)),
    );
    if (!res.success) return res;
    return { success: true as const, data: res.data.data };
  },
};
