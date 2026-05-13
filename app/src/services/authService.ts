import { apiClient } from './api';
import { API_CONFIG } from '@/constants';
import type {
  LoginCredentials,
  RegisterCredentials,
  LoginResponse,
  RegisterPendingResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendVerificationRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '@/types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>(
      API_CONFIG.ENDPOINTS.AUTH.LOGIN,
      credentials,
    );
    return res.data;
  },

  async register(credentials: RegisterCredentials): Promise<RegisterPendingResponse> {
    const res = await apiClient.post<RegisterPendingResponse>(
      API_CONFIG.ENDPOINTS.AUTH.REGISTER,
      credentials,
    );
    return res.data;
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const res = await apiClient.post<VerifyEmailResponse>(
      API_CONFIG.ENDPOINTS.AUTH.VERIFY_EMAIL,
      data,
    );
    return res.data;
  },

  async resendVerification(data: ResendVerificationRequest): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESEND_VERIFICATION, data);
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
  },

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },
};
