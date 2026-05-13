import { authService } from '@/services';
import { getErrorMessage } from '@/services/api';
import { secureStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants';
import type {
  OperationResult,
  User,
  LoginCredentials,
  RegisterCredentials,
  Tenant,
} from '@/types';

// Token é persistido pelo interceptor de api.ts a partir do Set-Cookie.
// Aqui só lemos de SecureStore depois da request pra confirmar que veio.
async function readPersistedToken(): Promise<string | null> {
  return secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

export const authOperations = {
  async performLogin(
    credentials: LoginCredentials,
  ): Promise<OperationResult<{ user: User; token: string }>> {
    try {
      if (!credentials.email || !credentials.password) {
        return {
          success: false,
          error: 'Preencha email e senha',
          code: 'INVALID_INPUT',
        };
      }

      const response = await authService.login(credentials);
      const token = await readPersistedToken();

      if (!token) {
        return {
          success: false,
          error: 'Não foi possível obter sessão. Tente novamente.',
          code: 'NO_TOKEN',
        };
      }

      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        username: response.user.username,
        role: response.user.role,
        isStaff: response.user.isStaff,
        tenant: response.tenant,
        tenantId: response.tenant.id,
      };

      await secureStorage.setObject(STORAGE_KEYS.USER_DATA, user);

      return { success: true, data: { user, token } };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        code: 'AUTH_FAILED',
      };
    }
  },

  async performRegister(
    credentials: RegisterCredentials,
  ): Promise<OperationResult<{ email: string; message: string; tenant: Tenant }>> {
    try {
      const response = await authService.register(credentials);
      return {
        success: true,
        data: {
          email: response.email,
          message: response.message,
          tenant: response.tenant,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        code: 'REGISTER_FAILED',
      };
    }
  },

  async performLogout(): Promise<OperationResult<null>> {
    try {
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.USER_DATA);
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao sair', code: 'LOGOUT_ERROR' };
    }
  },

  async checkAuthStatus(): Promise<
    OperationResult<{ user: User; token: string }>
  > {
    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const user = await secureStorage.getObject<User>(STORAGE_KEYS.USER_DATA);

      if (!token || !user) {
        return {
          success: false,
          error: 'Não autenticado',
          code: 'NOT_AUTHENTICATED',
        };
      }

      return { success: true, data: { user, token } };
    } catch {
      return {
        success: false,
        error: 'Erro ao verificar autenticação',
        code: 'AUTH_CHECK_ERROR',
      };
    }
  },
};
