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
      const token = response.token;

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

      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
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
      // Avisa o backend pra revogar a Session (jti) — sem isso o JWT
      // continua válido pelos 7 dias do TTL mesmo após "sair" no app.
      // Falha de rede/401 não impede logout local.
      try {
        await authService.logout();
      } catch {
        // ignora — limpar local é o essencial
      }
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.USER_DATA);
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao sair', code: 'LOGOUT_ERROR' };
    }
  },

  async refreshUser(): Promise<OperationResult<User>> {
    try {
      const fresh = await authService.me();
      const user: User = {
        id: fresh.id,
        name: fresh.name,
        email: fresh.email,
        username: fresh.username,
        role: fresh.role,
        isStaff: fresh.isStaff,
        tenantId: fresh.tenantId ?? fresh.tenant?.id,
        tenant: fresh.tenant,
      };
      await secureStorage.setObject(STORAGE_KEYS.USER_DATA, user);
      return { success: true, data: user };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        code: 'REFRESH_FAILED',
      };
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
