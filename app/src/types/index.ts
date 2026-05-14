export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  role?: UserRole;
  isStaff?: boolean;
  tenantId?: string;
  tenant?: Tenant;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  username: string;
  email: string;
  password: string;
  companyName?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    role: UserRole;
    isStaff: boolean;
  };
  tenant: Tenant;
  token: string;
}

export interface RegisterPendingResponse {
  message: string;
  email: string;
  tenant: Tenant;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
  };
  tenant: Tenant;
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiError {
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  pages?: number;
}

export type BillType = 'payable' | 'receivable';
export type BillStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Bill {
  id: string;
  description: string;
  amount: number;
  type: BillType;
  status: BillStatus;
  dueDate: string;
  paidDate?: string | null;
  category?: string | null;
  notes?: string | null;
  productCost?: number | null;
  refundedAmount?: number;
  quantity?: number;
  mlOrderId?: string | null;
  mlPackId?: string | null;
}

export interface CashPools {
  period: { start: string; end: string };
  vendasLiquidas: number;
  cmv: number;
  vendasSemCusto: number;
  vendasTotais: number;
  alocadoReposicao: number;
  gastoReposicao: number;
  caixaReposicao: number;
  caixaReserva: number;
  lucroOperacional: number;
}

export interface RelatorioKPIs {
  pedidos: number;
  vendas: number;
  bruto: number;
  taxaVenda: number;
  envio: number;
  totalVenda: number;
  custo: number;
  lucro: number;
}

export interface RelatorioTopProduto {
  productId: string | null;
  mlListingId: string | null;
  name: string;
  variation: string | null;
  vendas: number;
  bruto: number;
  totalVenda: number;
  custo: number;
  lucro: number;
  margem: number;
}

export interface RelatorioV2Response {
  periodo: { from: string; to: string };
  periodoAnterior: { from: string; to: string };
  kpisAtual: RelatorioKPIs;
  kpisAnterior: RelatorioKPIs;
  derivados: {
    ticketMedio: number;
    ticketMedioAnterior: number;
    margemPct: number;
    margemPctAnterior: number;
  };
  cancelamentos: {
    vendas: number;
    bruto: number;
    totalVenda: number;
    taxaPct: number;
  };
  timeline: Array<{
    date: string;
    pedidos: number;
    vendas: number;
    bruto: number;
    totalVenda: number;
    lucro: number;
  }>;
  topPorLucro: Array<RelatorioTopProduto>;
  topPorBruto: Array<RelatorioTopProduto>;
}

export interface DashboardSummary {
  vendasHoje: {
    pedidos: number;
    bruto: number;
    lucro: number;
  };
  contasVencendo: { total: number; count: number; bills: Bill[] };
  caixa: CashPools | null;
}

export type NotificationType = 'sale' | 'refund' | 'mp_release' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export interface ProductImage {
  id: string;
  url: string;
  order: number;
}

export interface ProductVariant {
  id: string;
  cod: string | null;
  title: string | null;
  salePrice: number | null;
  stock: number;
  mlListingId: string | null;
  active: boolean;
  // Optional: list endpoint inclui, detail endpoint omite.
  images?: ProductImage[];
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  mlListingId?: string | null;
  baseSalePrice?: number | null;
  minStock?: number | null;
  active: boolean;
  productCost?: number | null;
  variants: ProductVariant[];
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
