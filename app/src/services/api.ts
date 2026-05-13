import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '@/constants';
import { secureStorage } from '@/utils/storage';
import { toast } from '@/utils/toast';
import type { ApiError } from '@/types';

let onForceLogout: (() => void) | null = null;

export function setForceLogoutHandler(handler: () => void) {
  onForceLogout = handler;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Platform': 'mobile',
  },
});

// Backend (aglivre/web) usa cookie httpOnly `token`. Em mobile não temos
// cookie jar nativo do navegador, então persistimos o JWT em SecureStore
// e enviamos manualmente como `Cookie: token=<jwt>` em cada request.
async function extractTokenFromSetCookie(
  setCookie: string | string[] | undefined,
): Promise<void> {
  if (!setCookie) return;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = /(?:^|;\s*)token=([^;]*)/.exec(c);
    if (match) {
      const value = match[1];
      if (value && value.trim() !== '') {
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, value);
      } else {
        // Cookie zerado pelo backend = logout/invalidation
        await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
      return;
    }
  }
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (config.headers) {
      config.headers['X-Client-Platform'] = 'mobile';
    }

    const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token && token.trim() !== '' && config.headers) {
      config.headers.Cookie = `token=${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  async (response: AxiosResponse) => {
    await extractTokenFromSetCookie(
      response.headers['set-cookie'] as string | string[] | undefined,
    );
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const isAuthRoute = error.config?.url?.includes('/auth/');

    if (__DEV__ && !(isAuthRoute && (status === 401 || status === 403))) {
      console.error(`[API] Error ${status}:`, error.message, error.config?.url);
    }

    switch (status) {
      case 401:
        if (!isAuthRoute) {
          await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          await secureStorage.removeItem(STORAGE_KEYS.USER_DATA);
          toast.error('Sessão expirada', 'Faça login novamente');
          onForceLogout?.();
        }
        break;
      case 403:
        if (!isAuthRoute) {
          toast.error('Acesso negado', 'Você não tem permissão');
        }
        break;
      case 500:
      case 502:
      case 503:
        toast.error('Erro no servidor', 'Tente novamente mais tarde');
        break;
      default:
        if (!error.response) {
          toast.error('Sem conexão', 'Verifique sua internet');
        }
        break;
    }

    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<ApiError>;
    const data = e.response?.data;
    // aglivre/web usa { error: "..." }; mantemos fallback pra `message`
    // por compatibilidade com outros formatos.
    const err = data?.error as unknown;
    const msg = data?.message as unknown;
    const text = (typeof err === 'string' && err) || msg;
    if (Array.isArray(text)) return text.join(', ');
    if (typeof text === 'string' && text) return text;

    if (e.code === 'ECONNABORTED') return 'Tempo de conexão esgotado.';
    if (!e.response) return 'Sem conexão com o servidor.';
    switch (e.response.status) {
      case 400:
        return 'Dados inválidos.';
      case 401:
        return 'Credenciais inválidas.';
      case 403:
        return 'Sem permissão.';
      case 404:
        return 'Não encontrado.';
      case 409:
        return 'Já existe um registro com esses dados.';
      case 500:
        return 'Erro interno do servidor.';
      default:
        return 'Ocorreu um erro.';
    }
  }
  if (error instanceof Error) return error.message;
  return 'Erro inesperado.';
}

export async function apiCall<T>(
  request: () => Promise<AxiosResponse<T>>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await request();
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export { apiClient };
