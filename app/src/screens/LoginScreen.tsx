import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Input, Button, Checkbox, FadeInView, SlideUpView, Logo } from '@/components';
import { useAuth, useTheme } from '@/contexts';
import { biometricService } from '@/services';
import { secureStorage } from '@/utils/storage';
import { toast } from '@/utils/toast';
import { SPACING, STORAGE_KEYS } from '@/constants';

export default function LoginScreen() {
  const { login, register, isLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Register fields
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const dynamicStyles = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      footerText: { color: colors.textSecondary },
      subtitle: { color: colors.textSecondary },
    }),
    [colors],
  );

  useEffect(() => {
    const loadSaved = async () => {
      const savedEmail = await secureStorage.getItem(STORAGE_KEYS.SAVED_EMAIL);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    };
    loadSaved();
  }, []);

  const resetForms = useCallback(() => {
    setErrors({});
    setPassword('');
    setShowPassword(false);
    setRegisterName('');
    setRegisterUsername('');
    setRegisterCompany('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterConfirm('');
  }, []);

  const handleLogin = useCallback(async () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }
    if (!password || password.length < 1) {
      newErrors.password = 'Digite sua senha';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (rememberMe) {
      await secureStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, email);
    } else {
      await secureStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
    }

    const result = await login({ email, password });
    if (!result.success) {
      if (result.error?.includes('não verificado') || result.error?.includes('EMAIL_NOT_VERIFIED')) {
        toast.info('Email não verificado', 'Verifique seu email para continuar');
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        toast.error('Erro no login', result.error || 'Credenciais inválidas');
      }
      return;
    }

    // Após primeiro login, oferecer habilitar biometria se device suporta
    // e o user ainda não foi perguntado. Alert nativo é fire-and-forget —
    // navegação pra home já aconteceu via Gate em app/index.tsx.
    if (await biometricService.shouldOfferEnable()) {
      const name = await biometricService.friendlyName();
      Alert.alert(
        `Usar ${name}?`,
        `Da próxima vez que abrir o app, você pode entrar usando ${name} em vez de digitar a senha.`,
        [
          {
            text: 'Agora não',
            style: 'cancel',
            onPress: () => {
              void biometricService.markPrompted();
            },
          },
          {
            text: 'Habilitar',
            onPress: async () => {
              const ok = await biometricService.authenticate(
                `Habilitar ${name} pro AgLivre`,
              );
              if (ok) {
                await biometricService.enable();
                toast.success(`${name} habilitado`);
              } else {
                await biometricService.markPrompted();
              }
            },
          },
        ],
      );
    }
  }, [email, password, rememberMe, login, router]);

  const handleRegister = useCallback(async () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!registerName.trim() || registerName.trim().length < 3) {
      newErrors.registerName = 'Mínimo 3 caracteres';
    }
    if (!registerUsername.trim() || !/^[a-z0-9_]{3,30}$/.test(registerUsername.trim())) {
      newErrors.registerUsername = 'Use letras minúsculas, números ou _ (3-30 chars)';
    }
    if (!registerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)) {
      newErrors.registerEmail = 'Email inválido';
    }
    if (!registerPassword || registerPassword.length < 6) {
      newErrors.registerPassword = 'Mínimo 6 caracteres';
    }
    if (registerPassword !== registerConfirm) {
      newErrors.registerConfirm = 'Senhas não conferem';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const result = await register({
      name: registerName.trim(),
      username: registerUsername.trim().toLowerCase(),
      email: registerEmail.trim(),
      password: registerPassword,
      companyName: registerCompany.trim() || undefined,
    });

    if (result.success && result.email) {
      toast.success('Conta criada!', 'Verifique seu email para ativar o acesso');
      router.push(
        `/verify-email?email=${encodeURIComponent(result.email)}`,
      );
    } else if (!result.success) {
      toast.error('Erro no cadastro', result.error || 'Tente novamente');
    }
  }, [registerName, registerUsername, registerCompany, registerEmail, registerPassword, registerConfirm, register, router]);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, dynamicStyles.container]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.themeToggleContainer}>
        <TouchableOpacity
          style={styles.themeToggle}
          onPress={toggleTheme}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={0} duration={600} style={styles.headerContainer}>
            <Logo size="lg" orientation="column" label="Gestão de Vendas" />
          </FadeInView>

          <FadeInView delay={150} duration={400}>
            <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
              {isRegisterMode ? 'Crie sua conta' : 'Entre na sua conta'}
            </Text>
          </FadeInView>

          <SlideUpView delay={200} style={styles.formContainer}>
            {!isRegisterMode ? (
              /* ---- LOGIN ---- */
              <>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearError('email');
                  }}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.email}
                />

                <Input
                  label="Senha"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearError('password');
                  }}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  rightIcon={
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textPrimary}
                    />
                  }
                  onRightIconPress={() => setShowPassword((p) => !p)}
                />

                <View style={styles.optionsContainer}>
                  <Checkbox
                    checked={rememberMe}
                    onPress={() => setRememberMe((r) => !r)}
                    label="Lembrar de mim"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/forgot-password?email=${encodeURIComponent(email.trim())}` as never,
                      )
                    }
                  >
                    <Text style={[styles.forgotText, { color: colors.primary }]}>
                      Esqueci a senha
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.buttonContainer}>
                  <Button title="ENTRAR" onPress={handleLogin} loading={isLoading} />
                </View>

                <TouchableOpacity
                  style={styles.registerLink}
                  onPress={() => router.push('/waitlist' as never)}
                >
                  <Text style={[styles.registerText, { color: colors.textSecondary }]}>
                    Não tem conta?{' '}
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      Entrar na lista de espera
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ---- REGISTER ---- */
              <>
                <Input
                  label="Seu nome"
                  value={registerName}
                  onChangeText={(t) => {
                    setRegisterName(t);
                    clearError('registerName');
                  }}
                  placeholder="João Silva"
                  autoCapitalize="words"
                  error={errors.registerName}
                />

                <Input
                  label="Username"
                  value={registerUsername}
                  onChangeText={(t) => {
                    setRegisterUsername(t);
                    clearError('registerUsername');
                  }}
                  placeholder="joao_silva"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.registerUsername}
                />

                <Input
                  label="Nome do negócio (opcional)"
                  value={registerCompany}
                  onChangeText={setRegisterCompany}
                  placeholder="Fazenda Boa Terra"
                  autoCapitalize="words"
                />

                <Input
                  label="Email"
                  value={registerEmail}
                  onChangeText={(t) => {
                    setRegisterEmail(t);
                    clearError('registerEmail');
                  }}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.registerEmail}
                />

                <Input
                  label="Senha"
                  value={registerPassword}
                  onChangeText={(t) => {
                    setRegisterPassword(t);
                    clearError('registerPassword');
                  }}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry={!showPassword}
                  error={errors.registerPassword}
                  rightIcon={
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textPrimary}
                    />
                  }
                  onRightIconPress={() => setShowPassword((p) => !p)}
                />

                <Input
                  label="Confirmar senha"
                  value={registerConfirm}
                  onChangeText={(t) => {
                    setRegisterConfirm(t);
                    clearError('registerConfirm');
                  }}
                  placeholder="Repita a senha"
                  secureTextEntry={!showPassword}
                  error={errors.registerConfirm}
                />

                <View style={styles.buttonContainer}>
                  <Button title="CRIAR CONTA" onPress={handleRegister} loading={isLoading} />
                </View>

                <TouchableOpacity
                  style={styles.registerLink}
                  onPress={() => {
                    setIsRegisterMode(false);
                    resetForms();
                  }}
                >
                  <Text style={[styles.registerText, { color: colors.textSecondary }]}>
                    Já tem conta?{' '}
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      Entrar
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </SlideUpView>

          <FadeInView delay={400} style={styles.footerContainer}>
            <Text style={[styles.footerText, dynamicStyles.footerText]}>
              AgLivre • v0.1.0
            </Text>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontWeight: '600',
  },
  formContainer: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonContainer: { marginTop: SPACING.lg },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: { fontSize: 12, opacity: 0.8 },
  themeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  themeToggle: { padding: SPACING.sm },
  registerLink: { alignItems: 'center', marginTop: SPACING.lg },
  registerText: { fontSize: 14 },
  forgotText: { fontSize: 13, fontWeight: '600' },
});
