import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components';
import { useTheme } from '@/contexts';
import { authService } from '@/services/authService';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE } from '@/constants';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = 'E-mail obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'E-mail inválido';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);

    try {
      await authService.forgotPassword({ email: email.trim() });
    } catch {
      // Silently ignore — anti-enumeration
    } finally {
      setIsLoading(false);
    }

    toast.info(
      'Código enviado',
      'Se esse email estiver cadastrado, você receberá um código em instantes.',
    );
    router.push(
      `/reset-password?email=${encodeURIComponent(email.trim())}` as never,
    );
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
            Esqueceu a senha?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Informe seu email e enviaremos um código de 6 dígitos para redefinir
            sua senha.
          </Text>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="seu@email.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (errors.email) setErrors({});
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />

            <Button
              title="Enviar código"
              onPress={handleSubmit}
              loading={isLoading}
              style={styles.submitButton}
            />
          </View>

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
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  form: {
    gap: SPACING.md,
  },
  submitButton: {
    marginTop: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
