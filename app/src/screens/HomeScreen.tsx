import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, useTheme } from '@/contexts';
import { FadeInView, SlideUpView, Logo } from '@/components';
import { SPACING, COLORS, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import { toast } from '@/utils/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { dashboardService, notificationService } from '@/services';
import type { DashboardSummary } from '@/types';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [summaryRes, notifRes] = await Promise.all([
      dashboardService.summary(),
      notificationService.list(),
    ]);
    if (summaryRes.success) {
      setSummary(summaryRes.data);
    } else {
      toast.error('Erro ao carregar', summaryRes.error);
    }
    if (notifRes.success) {
      setUnreadCount(notifRes.data.unreadCount);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void notificationService.list().then((res) => {
        if (res.success) setUnreadCount(res.data.unreadCount);
      });
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const dynamicStyles = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      card: {
        backgroundColor: colors.backgroundCard,
        borderColor: colors.border,
      },
      title: { color: colors.textPrimary },
      subtitle: { color: colors.textSecondary },
      muted: { color: colors.textMuted },
      primary: { color: colors.primary },
    }),
    [colors],
  );

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <FadeInView delay={0} duration={400}>
          <Logo size="md" />
        </FadeInView>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/notifications' as never)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.textPrimary}
            />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/settings' as never)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <FadeInView delay={50}>
          <Text style={[styles.greeting, dynamicStyles.title]}>
            Olá, {user?.name?.trim().split(' ')[0] || user?.username || 'Usuário'}
          </Text>
          <Text style={[styles.greetingSub, dynamicStyles.subtitle]}>
            Resumo de hoje
          </Text>
        </FadeInView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : summary ? (
          <>
            <SlideUpView delay={100}>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.kpiCardHalf, dynamicStyles.card]}
                  onPress={() => router.push('/vendas' as never)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="cash-outline"
                    size={22}
                    color={colors.success}
                  />
                  <Text style={[styles.kpiLabelSm, dynamicStyles.subtitle]}>
                    Vendas hoje
                  </Text>
                  <Text style={[styles.kpiValueSm, dynamicStyles.title]}>
                    {formatCurrency(summary.vendasHoje.bruto)}
                  </Text>
                  <Text style={[styles.kpiFootSm, dynamicStyles.muted]}>
                    {summary.vendasHoje.pedidos}{' '}
                    {summary.vendasHoje.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.kpiCardHalf, dynamicStyles.card]}
                  onPress={() => router.push('/relatorios' as never)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={22}
                    color={
                      summary.vendasHoje.lucro >= 0
                        ? colors.success
                        : colors.error
                    }
                  />
                  <Text style={[styles.kpiLabelSm, dynamicStyles.subtitle]}>
                    Lucro hoje
                  </Text>
                  <Text
                    style={[
                      styles.kpiValueSm,
                      {
                        color:
                          summary.vendasHoje.lucro >= 0
                            ? colors.textPrimary
                            : colors.error,
                      },
                    ]}
                  >
                    {formatCurrency(summary.vendasHoje.lucro)}
                  </Text>
                  <Text style={[styles.kpiFootSm, dynamicStyles.muted]}>
                    sobre vendas
                  </Text>
                </TouchableOpacity>
              </View>
            </SlideUpView>

            <SlideUpView delay={150}>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.kpiCardHalf, dynamicStyles.card]}
                  onPress={() => router.push('/caixas' as never)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={[styles.kpiLabelSm, dynamicStyles.subtitle]}>
                    Caixa de reposição
                  </Text>
                  <Text style={[styles.kpiValueSm, dynamicStyles.title]}>
                    {formatCurrency(summary.caixa?.caixaReposicao ?? 0)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.kpiCardHalf, dynamicStyles.card]}
                  onPress={() => router.push('/caixas' as never)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={22}
                    color={colors.info}
                  />
                  <Text style={[styles.kpiLabelSm, dynamicStyles.subtitle]}>
                    Lucro do mês
                  </Text>
                  <Text style={[styles.kpiValueSm, dynamicStyles.title]}>
                    {formatCurrency(summary.caixa?.lucroOperacional ?? 0)}
                  </Text>
                </TouchableOpacity>
              </View>
            </SlideUpView>

            <SlideUpView delay={200}>
              <TouchableOpacity
                onPress={() => router.push('/contas' as never)}
                activeOpacity={0.7}
                style={[styles.sectionCard, dynamicStyles.card]}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={20}
                      color={colors.warning}
                    />
                    <Text style={[styles.sectionTitle, dynamicStyles.title]}>
                      Contas vencendo (7 dias)
                    </Text>
                  </View>
                  <Text style={[styles.sectionTotal, dynamicStyles.primary]}>
                    {formatCurrency(summary.contasVencendo.total)}
                  </Text>
                </View>

                {summary.contasVencendo.bills.length === 0 ? (
                  <Text style={[styles.empty, dynamicStyles.muted]}>
                    Nenhuma conta vencendo nos próximos 7 dias.
                  </Text>
                ) : (
                  summary.contasVencendo.bills.map((b) => (
                    <View key={b.id} style={styles.billRow}>
                      <View style={styles.billInfo}>
                        <Text
                          style={[styles.billDesc, dynamicStyles.title]}
                          numberOfLines={1}
                        >
                          {b.description}
                        </Text>
                        <Text style={[styles.billDate, dynamicStyles.muted]}>
                          Vence em {formatDate(b.dueDate)}
                        </Text>
                      </View>
                      <Text style={[styles.billAmount, dynamicStyles.title]}>
                        {formatCurrency(b.amount)}
                      </Text>
                    </View>
                  ))
                )}

                {summary.contasVencendo.count >
                  summary.contasVencendo.bills.length && (
                  <Text style={[styles.more, dynamicStyles.muted]}>
                    +{' '}
                    {summary.contasVencendo.count -
                      summary.contasVencendo.bills.length}{' '}
                    {summary.contasVencendo.count -
                      summary.contasVencendo.bills.length ===
                    1
                      ? 'conta'
                      : 'contas'}
                  </Text>
                )}
              </TouchableOpacity>
            </SlideUpView>

            {summary.caixa && summary.caixa.vendasSemCusto > 0 && (
              <SlideUpView delay={250}>
                <View style={[styles.warning, { borderColor: colors.warning }]}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={colors.warning}
                  />
                  <Text style={[styles.warningText, dynamicStyles.subtitle]}>
                    {summary.caixa.vendasSemCusto}{' '}
                    {summary.caixa.vendasSemCusto === 1 ? 'venda' : 'vendas'} sem
                    custo cadastrado — Caixa de Reposição subestimada.
                  </Text>
                </View>
              </SlideUpView>
            )}
          </>
        ) : (
          <Text style={[styles.empty, dynamicStyles.muted]}>
            Não foi possível carregar o resumo.
          </Text>
        )}
      </ScrollView>

      <FadeInView delay={500} style={styles.footer}>
        <Text style={[styles.footerText, dynamicStyles.muted]}>
          AgLivre • v0.1.0
        </Text>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerActions: { flexDirection: 'row', gap: SPACING.sm },
  headerIcon: { padding: SPACING.sm, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  greeting: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  greetingSub: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.lg },
  loading: { paddingVertical: SPACING.xxl, alignItems: 'center' },
  kpiCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  kpiLabel: { fontSize: FONT_SIZE.sm },
  kpiValue: { fontSize: 28, fontWeight: '700' },
  kpiFoot: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  kpiCardHalf: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  kpiLabelSm: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  kpiValueSm: { fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 2 },
  kpiFootSm: { fontSize: 10, marginTop: 2 },
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  sectionTotal: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  billInfo: { flex: 1, marginRight: SPACING.md },
  billDesc: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  billDate: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  billAmount: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  more: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  warningText: { fontSize: FONT_SIZE.xs, flex: 1, lineHeight: 18 },
  empty: { fontSize: FONT_SIZE.sm, textAlign: 'center', padding: SPACING.md },
  footer: { alignItems: 'center', paddingVertical: SPACING.md },
  footerText: { fontSize: FONT_SIZE.xs, opacity: 0.8 },
});
