import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Input } from '@/components';
import { useTheme } from '@/contexts';
import { authService } from '@/services/authService';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS, COLORS } from '@/constants';

const CODE_LENGTH = 6;
const COOLDOWN_SECONDS = 60;

interface Props {
  email: string;
}

export default function ResetPasswordScreen({ email }: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const digitRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.replace('/' as never);
    }
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = sanitized;
    setDigits(next);
    if (sanitized && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const code = digits.join('');
  const isCodeComplete = code.length === CODE_LENGTH;

  const handleSubmit = async () => {
    setCodeError('');
    setPasswordError('');

    if (!isCodeComplete) {
      setCodeError('Preencha o código de 6 dígitos.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não conferem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword({ email, code, newPassword });
      toast.success('Senha redefinida!', 'Faça login para continuar.');
      router.replace('/' as never);
    } catch (err) {
      const e = err as Error;
      setCodeError(e.message || 'Código inválido. Tente novamente.');
      setDigits(Array(CODE_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);

    try {
      await authService.forgotPassword({ email });
      toast.success('Código reenviado', 'Verifique seu email.');
      setCooldown(COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
    } catch {
      toast.error('Erro', 'Não foi possível reenviar o código. Tente novamente.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={32} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Redefinir senha
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enviamos um código para:{' '}
          </Text>
          <Text
            style={[styles.email, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {email}
          </Text>

          <View style={styles.otpSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Código de verificação
            </Text>
            <View style={styles.otpRow}>
              {digits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => {
                    digitRefs.current[i] = el;
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
            {codeError ? (
              <Text style={styles.errorText}>{codeError}</Text>
            ) : (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                O código expira em 10 minutos
              </Text>
            )}
          </View>

          <View style={styles.passwordSection}>
            <Input
              label="Nova senha"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
              error={passwordError}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="Confirmar nova senha"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
            />
          </View>

          <Button
            title="Redefinir senha"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />

          <TouchableOpacity
            onPress={handleResend}
            disabled={cooldown > 0 || isResending}
            style={[styles.resendButton, (cooldown > 0 || isResending) && styles.disabled]}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={cooldown > 0 || isResending ? colors.textMuted : colors.primary}
            />
            <Text
              style={[
                styles.resendText,
                { color: cooldown > 0 || isResending ? colors.textMuted : colors.primary },
              ]}
            >
              {isResending
                ? ' Reenviando...'
                : cooldown > 0
                ? ` Reenviar em ${cooldown}s`
                : ' Não recebi — reenviar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/' as never)}
            style={styles.footer}
          >
            <Ionicons name="arrow-back" size={16} color={colors.primary} />
            <Text style={[styles.footerText, { color: colors.primary }]}>
              {' '}Voltar ao login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
  },
  email: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: SPACING.xl,
  },
  otpSection: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  otpRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  digitInput: {
    width: 46,
    height: 56,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    textAlign: 'center',
  },
  passwordSection: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  submitButton: {
    marginBottom: SPACING.md,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
