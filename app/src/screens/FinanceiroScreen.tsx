import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTheme } from '@/contexts';
import { FadeInView, SlideUpView } from '@/components';
import { cashPoolService, dashboardService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { CashPools, DashboardSummary } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface MonthData {
  label: string;
  start: string;
  end: string;
  data: CashPools | null;
}

const MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthRange(monthsAgo: number): { start: string; end: string; label: string } {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const start = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-01`;
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const end = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(lastDay)}`;
  const label = target
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    .replace('.', '');
  return { start, end, label };
}

function currentMonthLabel(): string {
  const now = new Date();
  const name = MONTHS_FULL[now.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${now.getFullYear()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiSmall({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  onPress,
  colors,
}: {
  icon: IoniconName;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  onPress?: () => void;
  colors: ThemeColors;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
  return (
    <Wrapper
      {...(wrapperProps as object)}
      style={[
        kpiStyles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={[kpiStyles.label, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[kpiStyles.value, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </Wrapper>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 2,
  },
  label: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  value: { fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 2 },
});

function ShortcutCard({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  badge,
  onPress,
  colors,
}: {
  icon: IoniconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        shortcutStyles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <View style={[shortcutStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={shortcutStyles.body}>
        <Text style={[shortcutStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[shortcutStyles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {badge ? (
        <View style={[shortcutStyles.badge, { backgroundColor: colors.warning + '22' }]}>
          <Text style={[shortcutStyles.badgeText, { color: colors.warning }]}>
            {badge}
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const shortcutStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  subtitle: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

function Bar({
  height,
  color,
  label,
  colors,
}: {
  height: number;
  color: string;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View style={chartStyles.barWrap}>
      <View
        style={[
          chartStyles.bar,
          { height: Math.max(height, 2), backgroundColor: color },
        ]}
      />
      {label !== '' && (
        <Text
          style={[chartStyles.barLabel, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

function LegendDot({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendDot, { backgroundColor: color }]} />
      <Text style={[chartStyles.legendText, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    marginTop: SPACING.md,
  },
  chartCol: { alignItems: 'center', flex: 1, gap: SPACING.xs },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 160,
  },
  barWrap: { alignItems: 'center', gap: 4 },
  bar: { width: 18, borderRadius: 4 },
  barLabel: { fontSize: 9, maxWidth: 70 },
  chartLabel: { fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FONT_SIZE.xs },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FinanceiroScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const ranges = useMemo(
    () => [{ ...monthRange(2) }, { ...monthRange(1) }, { ...monthRange(0) }],
    [],
  );

  const [months, setMonths] = useState<MonthData[]>(
    ranges.map((r) => ({ ...r, data: null })),
  );
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [caixaReposicaoTotal, setCaixaReposicaoTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // start=2010-01-01 cobre histórico completo → caixaReposicao lifetime.
    // SEM end pra o backend usar "agora" como fim (idêntico ao painel web em
    // /admin/financeiro/painel, que chama /cash-pools?start=2010-01-01 sem end).
    const [summaryRes, lifetimeRes, ...monthResults] = await Promise.all([
      dashboardService.summary(),
      cashPoolService.range('2010-01-01'),
      ...ranges.map((r) => cashPoolService.range(r.start, r.end)),
    ]);

    if (summaryRes.success) setSummary(summaryRes.data);
    else toast.error('Erro ao carregar painel', summaryRes.error);

    // Math.max(0, …) igual ao web: saldo a repor não fica negativo na UI.
    if (lifetimeRes.success)
      setCaixaReposicaoTotal(Math.max(0, lifetimeRes.data.caixaReposicao));

    const next = ranges.map((r, i) => {
      const res = monthResults[i];
      return { ...r, data: res.success ? res.data : null };
    });
    setMonths(next);
  }, [ranges]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const maxValue = useMemo(() => {
    let max = 0;
    months.forEach((m) => {
      if (!m.data) return;
      max = Math.max(max, m.data.vendasLiquidas, m.data.cmv + m.data.gastoReposicao);
    });
    return Math.max(max, 1);
  }, [months]);

  const current = months[months.length - 1]?.data ?? null;
  const contasVencendo = summary?.contasVencendo;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Financeiro
        </Text>
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
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loading}
          />
        ) : (
          <>
            <FadeInView delay={50}>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Painel · {currentMonthLabel()}
              </Text>
            </FadeInView>

            {current && (
              <SlideUpView delay={80}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/relatorios' as never)}
                  style={[
                    styles.headlineCard,
                    {
                      backgroundColor: colors.backgroundCard,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.headlineLabel, { color: colors.textMuted }]}>
                    LUCRO OPERACIONAL DO MÊS
                  </Text>
                  <Text
                    style={[
                      styles.headlineValue,
                      {
                        color:
                          current.lucroOperacional >= 0
                            ? colors.success
                            : colors.error,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatCurrency(current.lucroOperacional)}
                  </Text>
                </TouchableOpacity>
              </SlideUpView>
            )}

            {current && (
              <SlideUpView delay={120}>
                <View style={styles.row}>
                  <KpiSmall
                    icon="cash-outline"
                    iconColor={colors.success}
                    label="Vendas líquidas"
                    value={formatCurrency(current.vendasLiquidas)}
                    valueColor={colors.textPrimary}
                    colors={colors}
                  />
                  <KpiSmall
                    icon="cube-outline"
                    iconColor={colors.error}
                    label="CMV"
                    value={formatCurrency(current.cmv)}
                    valueColor={colors.textPrimary}
                    colors={colors}
                  />
                </View>
                <View style={styles.row}>
                  <KpiSmall
                    icon="wallet-outline"
                    iconColor={colors.primary}
                    label="Caixa reposição (total)"
                    value={formatCurrency(caixaReposicaoTotal ?? 0)}
                    valueColor={colors.textPrimary}
                    onPress={() => router.push('/caixas' as never)}
                    colors={colors}
                  />
                </View>
              </SlideUpView>
            )}

            {/* Atalhos */}
            <SlideUpView delay={160}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                ATALHOS
              </Text>
              <View style={styles.shortcuts}>
                <ShortcutCard
                  icon="document-text-outline"
                  iconColor={colors.warning}
                  iconBg={colors.warning + '1F'}
                  title="Contas a pagar"
                  subtitle={
                    contasVencendo && contasVencendo.count > 0
                      ? `${contasVencendo.count} vencendo em 7 dias · ${formatCurrency(contasVencendo.total)}`
                      : 'Sem contas vencendo nos próximos 7 dias'
                  }
                  badge={
                    contasVencendo && contasVencendo.count > 0
                      ? String(contasVencendo.count)
                      : undefined
                  }
                  onPress={() => router.push('/contas' as never)}
                  colors={colors}
                />
                <ShortcutCard
                  icon="stats-chart-outline"
                  iconColor={colors.primary}
                  iconBg={colors.primary + '1F'}
                  title="DRE Anual"
                  subtitle="Demonstração de resultado por ano"
                  onPress={() =>
                    router.push('/relatorios/dre-anual' as Href)
                  }
                  colors={colors}
                />
                <ShortcutCard
                  icon="wallet-outline"
                  iconColor={colors.info}
                  iconBg={colors.info + '1F'}
                  title="Caixas"
                  subtitle="Reposição e operacional"
                  onPress={() => router.push('/caixas' as never)}
                  colors={colors}
                />
                <ShortcutCard
                  icon="add-circle-outline"
                  iconColor={colors.success}
                  iconBg={colors.success + '1F'}
                  title="Lançar movimentação"
                  subtitle="Receita ou despesa avulsa"
                  onPress={() =>
                    router.push('/lancamentos/new' as Href)
                  }
                  colors={colors}
                />
              </View>
            </SlideUpView>

            {/* Gráfico */}
            <SlideUpView delay={200}>
              <View
                style={[
                  styles.chartCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                  Receitas vs custos
                </Text>
                <Text style={[styles.chartSub, { color: colors.textMuted }]}>
                  Últimos 3 meses
                </Text>

                <View style={chartStyles.chart}>
                  {months.map((m) => {
                    const vendas = m.data?.vendasLiquidas ?? 0;
                    const custos =
                      (m.data?.cmv ?? 0) + (m.data?.gastoReposicao ?? 0);
                    const hVendas = (vendas / maxValue) * 140;
                    const hCustos = (custos / maxValue) * 140;
                    return (
                      <View key={m.start} style={chartStyles.chartCol}>
                        <View style={chartStyles.chartBars}>
                          <Bar
                            height={hVendas}
                            color={colors.success}
                            label={vendas > 0 ? formatCurrency(vendas) : ''}
                            colors={colors}
                          />
                          <Bar
                            height={hCustos}
                            color={colors.error}
                            label={custos > 0 ? formatCurrency(custos) : ''}
                            colors={colors}
                          />
                        </View>
                        <Text
                          style={[
                            chartStyles.chartLabel,
                            { color: colors.textMuted },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={chartStyles.legend}>
                  <LegendDot
                    color={colors.success}
                    label="Receitas"
                    colors={colors}
                  />
                  <LegendDot
                    color={colors.error}
                    label="Custos (CMV + reposição)"
                    colors={colors}
                  />
                </View>
              </View>
            </SlideUpView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  loading: { marginTop: SPACING.xxl },

  subtitle: { fontSize: FONT_SIZE.sm },

  // Headline (lucro)
  headlineCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  headlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  headlineValue: { fontSize: 30, fontWeight: '700' },

  // Rows + Grid
  row: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },

  // Atalhos
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  shortcuts: { gap: SPACING.sm },

  // Chart
  chartCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  chartTitle: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  chartSub: { fontSize: FONT_SIZE.xs },
});
