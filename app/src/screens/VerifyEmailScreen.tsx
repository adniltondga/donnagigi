import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authService } from '@/services/authService';
import { useAuth, useTheme } from '@/contexts';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS, STORAGE_KEYS } from '@/constants';
import { secureStorage } from '@/utils/storage';

const CODE_LENGTH = 6;
const COOLDOWN_SECONDS = 60;

interface Props {
  email: string;
}

export default function VerifyEmailScreen({ email }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { checkAuth } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
      const next = [...digits];
      next[index] = sanitized;
      setDigits(next);

      if (sanitized && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH;

  const handleVerify = useCallback(async () => {
    if (!isComplete) return;
    setIsVerifying(true);

    try {
      const response = await authService.verifyEmail({ email, code });

      // Token foi persistido em SecureStore pelo response interceptor de api.ts
      // (extraído do header Set-Cookie). Aqui só salvamos o user.
      await secureStorage.setObject(STORAGE_KEYS.USER_DATA, {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        username: response.user.username,
        tenant: response.tenant,
        tenantId: response.tenant.id,
      });
      await checkAuth();
      toast.success('Email verificado!', 'Bem-vindo ao AgLivre');
      router.replace('/home');
    } catch (err) {
      const e = err as Error;
      toast.error('Código inválido', e.message || 'Tente novamente');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [isComplete, email, code, checkAuth, router]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);

    try {
      await authService.resendVerification({ email });
      toast.success('Código reenviado', 'Verifique seu email');
      setCooldown(COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      const e = err as Error;
      if (e.message?.includes('Aguarde')) {
        toast.info('Aguarde', e.message);
        setCooldown(COOLDOWN_SECONDS);
      } else {
        toast.error('Erro ao reenviar', e.message || 'Tente mais tarde');
      }
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending, email]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <View
              style={[styles.iconBg, { backgroundColor: colors.primary + '20' }]}
            >
              <Ionicons name="mail-outline" size={40} color={colors.primary} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Verifique seu email
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enviamos um código de 6 dígitos para:
          </Text>
          <Text style={[styles.email, { color: colors.textPrimary }]}>
            {email}
          </Text>

          <View style={styles.codeRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                style={[
                  styles.digitInput,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: digit ? colors.primary : colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={digit}
                onChangeText={(v) => handleDigitChange(i, v)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(i, nativeEvent.key)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          <Text style={[styles.expiry, { color: colors.textSecondary }]}>
            O código expira em 10 minutos
          </Text>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              { backgroundColor: colors.primary },
              (!isComplete || isVerifying) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={!isComplete || isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verificar email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendButton,
              (cooldown > 0 || isResending) && styles.buttonDisabled,
            ]}
            onPress={handleResend}
            disabled={cooldown > 0 || isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  { color: cooldown > 0 ? colors.textSecondary : colors.primary },
                ]}
              >
                {cooldown > 0
                  ? `Reenviar em ${cooldown}s`
                  : 'Não recebi o código — reenviar'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  email: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  codeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  digitInput: {
    width: 46,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  expiry: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xl,
  },
  verifyButton: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  resendText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
