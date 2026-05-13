import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants';

/**
 * Biometria (FaceID / TouchID / impressão digital Android) pra "destravar"
 * o app quando há sessão salva. Não substitui o login — só evita pedir
 * senha toda vez que o app é aberto.
 *
 * Fluxo:
 *  1. Após primeiro login bem-sucedido, `shouldOfferEnable()` retorna true
 *     se o device tem hardware + biometria cadastrada e a flag ainda
 *     não foi definida. UI pergunta "habilitar?".
 *  2. `enable()` persiste a flag. `disable()` remove.
 *  3. Ao abrir o app com sessão válida (`checkAuth` em AuthContext), se
 *     `isEnabled()` for true, chamar `authenticate()` antes de marcar
 *     `isAuthenticated`. Falha → forçar logout.
 */

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

async function capability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, types };
}

export const biometricService = {
  capability,

  /**
   * Nome amigável do método disponível (pra usar em textos da UI).
   */
  async friendlyName(): Promise<string> {
    const cap = await capability();
    if (cap.types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (cap.types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'biometria';
    }
    if (cap.types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'íris';
    }
    return 'biometria';
  },

  async isEnabled(): Promise<boolean> {
    const v = await secureStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return v === '1';
  },

  async enable(): Promise<void> {
    await secureStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, '1');
    await secureStorage.setItem(STORAGE_KEYS.BIOMETRIC_PROMPTED, '1');
  },

  async disable(): Promise<void> {
    await secureStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
  },

  async wasPrompted(): Promise<boolean> {
    const v = await secureStorage.getItem(STORAGE_KEYS.BIOMETRIC_PROMPTED);
    return v === '1';
  },

  async markPrompted(): Promise<void> {
    await secureStorage.setItem(STORAGE_KEYS.BIOMETRIC_PROMPTED, '1');
  },

  /**
   * Mostra prompt nativo de biometria. Retorna `true` se autenticou,
   * `false` se cancelou/falhou (incluindo "fallback pra senha do device"
   * — não confundimos com login da app, então tratamos como falha).
   */
  async authenticate(reason?: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason ?? 'Confirme sua identidade pra acessar o AgLivre',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
      });
      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * Combo: deve oferecer o "habilitar biometria" após login? True se
   * device suporta, tem biometria cadastrada, e o usuário ainda não foi
   * perguntado.
   */
  async shouldOfferEnable(): Promise<boolean> {
    const cap = await capability();
    if (!cap.hasHardware || !cap.isEnrolled) return false;
    const prompted = await this.wasPrompted();
    return !prompted;
  },
};
