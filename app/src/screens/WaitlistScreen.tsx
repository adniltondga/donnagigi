import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Input, Button, FadeInView, SlideUpView, Logo } from '@/components';
import { useTheme } from '@/contexts';
import { waitlistService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<'idle' | 'success' | 'already'>('idle');

  const dynamicStyles = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      subtitle: { color: colors.textSecondary },
      footerText: { color: colors.textSecondary },
    }),
    [colors],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Email inválido');
      return;
    }
    setSubmitting(true);
    const res = await waitlistService.subscribe(trimmed);
    setSubmitting(false);

    if (res.success) {
      if (res.data.alreadyRegistered) {
        setState('already');
      } else {
        setState('success');
        toast.success('Tudo certo!', 'Você está na lista de espera.');
      }
    } else {
      toast.error('Erro', res.error);
    }
  }, [email]);

  return (
    <SafeAreaView
      style={[styles.container, dynamicStyles.container]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.topBarBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleTheme}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.topBarBtn}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={0} duration={500} style={styles.headerContainer}>
            <Logo size="lg" orientation="column" label="Gestão de Vendas" />
          </FadeInView>

          <SlideUpView delay={150} style={styles.formContainer}>
            {state === 'idle' ? (
              <>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Entre na lista de espera
                </Text>
                <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
                  Os cadastros estão temporariamente fechados.{'\n'}
                  Deixe seu email e te avisamos assim que abrir.
                </Text>

                <Input
                  label="Email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (error) setError(null);
                  }}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={error ?? undefined}
                />

                <View style={styles.buttonContainer}>
                  <Button
                    title="ENTRAR NA LISTA"
                    onPress={handleSubmit}
                    loading={submitting}
                  />
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.successCard,
                  {
                    backgroundColor: colors.success + '14',
                    borderColor: colors.success,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.success + '22' },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={36}
                    color={colors.success}
                  />
                </View>
                <Text style={[styles.successTitle, { color: colors.success }]}>
                  {state === 'already'
                    ? 'Você já está na lista!'
                    : 'Tudo certo!'}
                </Text>
                <Text
                  style={[styles.successText, { color: colors.textSecondary }]}
                >
                  {state === 'already'
                    ? 'Esse email já está cadastrado. Te avisamos assim que abrir.'
                    : 'Te avisamos por email assim que os cadastros abrirem.'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.back()}
            >
              <Text style={[styles.loginText, dynamicStyles.subtitle]}>
                Já tem conta?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Entrar
                </Text>
              </Text>
            </TouchableOpacity>
          </SlideUpView>

          <FadeInView delay={300} style={styles.footerContainer}>
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
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  topBarBtn: { padding: SPACING.sm },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    gap: SPACING.sm,
  },
  formContainer: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  buttonContainer: { marginTop: SPACING.sm },
  successCard: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  successText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  loginLink: { alignItems: 'center', marginTop: SPACING.lg },
  loginText: { fontSize: FONT_SIZE.sm },
  footerContainer: { alignItems: 'center', paddingVertical: SPACING.xl },
  footerText: { fontSize: FONT_SIZE.xs, opacity: 0.8 },
});
