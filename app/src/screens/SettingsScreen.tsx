import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useTheme } from '@/contexts';
import { biometricService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, mode, setMode } = useTheme();
  const router = useRouter();

  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioName, setBioName] = useState('biometria');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const [enabled, name, cap] = await Promise.all([
        biometricService.isEnabled(),
        biometricService.friendlyName(),
        biometricService.capability(),
      ]);
      setBioEnabled(enabled);
      setBioName(name);
      setBioAvailable(cap.hasHardware && cap.isEnrolled);
    })();
  }, []);

  const handleBioToggle = useCallback(
    async (next: boolean) => {
      if (next) {
        const ok = await biometricService.authenticate(
          `Habilitar ${bioName} pro AgLivre`,
        );
        if (!ok) {
          toast.error('Não foi possível habilitar');
          return;
        }
        await biometricService.enable();
        setBioEnabled(true);
        toast.success(`${bioName} habilitado`);
      } else {
        await biometricService.disable();
        setBioEnabled(false);
        toast.info(`${bioName} desabilitado`);
      }
    },
    [bioName],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          toast.success('Até logo!');
          router.replace('/');
        },
      },
    ]);
  }, [logout, router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerIcon}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Configurações
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="person-circle" size={48} color={colors.primary} />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user.name}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user.email}
              </Text>
            </View>
          </View>
        )}

        <Section title="Aparência" colors={colors}>
          <ToggleRow
            icon="moon-outline"
            label="Modo escuro"
            value={mode === 'dark'}
            onChange={(v) => setMode(v ? 'dark' : 'light')}
            colors={colors}
          />
        </Section>

        <Section title="Segurança" colors={colors}>
          <ToggleRow
            icon="finger-print-outline"
            label={`Entrar com ${bioName}`}
            description={
              bioAvailable
                ? 'Use sua biometria pra destravar o app'
                : 'Não disponível neste dispositivo'
            }
            value={bioEnabled}
            onChange={handleBioToggle}
            disabled={!bioAvailable}
            colors={colors}
          />
        </Section>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.backgroundCard,
              borderColor: colors.error,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>
            Sair da conta
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.sectionContent,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
  disabled,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerIcon: { padding: SPACING.sm, minWidth: 42 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  content: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  userEmail: { fontSize: FONT_SIZE.sm },
  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  sectionContent: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  rowDesc: { fontSize: FONT_SIZE.xs, lineHeight: 16 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  logoutText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
});
