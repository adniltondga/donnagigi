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
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { cashPoolService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { CashPools } from '@/types';

interface MonthData {
  label: string;
  start: string;
  end: string;
  data: CashPools | null;
}

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

export default function FinanceiroScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const ranges = useMemo(
    () => [
      { ...monthRange(2) },
      { ...monthRange(1) },
      { ...monthRange(0) },
    ],
    [],
  );

  const [months, setMonths] = useState<MonthData[]>(
    ranges.map((r) => ({ ...r, data: null })),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.all(
      ranges.map((r) => cashPoolService.range(r.start, r.end)),
    );
    const next = ranges.map((r, i) => {
      const res = results[i];
      return {
        ...r,
        data: res.success ? res.data : null,
      };
    });
    setMonths(next);
    const anyFail = results.find((r) => !r.success);
    if (anyFail && !anyFail.success) {
      toast.error('Erro ao carregar', anyFail.error);
    }
  }, [ranges]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

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
          Painel financeiro
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
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
            {current && (
              <View
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
                >
                  {formatCurrency(current.lucroOperacional)}
                </Text>
              </View>
            )}

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

              <View style={styles.chart}>
                {months.map((m) => {
                  const vendas = m.data?.vendasLiquidas ?? 0;
                  const custos =
                    (m.data?.cmv ?? 0) + (m.data?.gastoReposicao ?? 0);
                  const hVendas = (vendas / maxValue) * 140;
                  const hCustos = (custos / maxValue) * 140;
                  return (
                    <View key={m.start} style={styles.chartCol}>
                      <View style={styles.chartBars}>
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
                        style={[styles.chartLabel, { color: colors.textMuted }]}
                      >
                        {m.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.legend}>
                <LegendDot color={colors.success} label="Receitas" colors={colors} />
                <LegendDot color={colors.error} label="Custos (CMV + reposição)" colors={colors} />
              </View>
            </View>

            {current && (
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.kpiTitle, { color: colors.textPrimary }]}>
                  Mês atual em detalhes
                </Text>
                <KpiRow
                  label="Vendas líquidas"
                  value={formatCurrency(current.vendasLiquidas)}
                  colors={colors}
                />
                <KpiRow
                  label="CMV"
                  value={formatCurrency(current.cmv)}
                  negative
                  colors={colors}
                />
                <KpiRow
                  label="Reposição gasta"
                  value={formatCurrency(current.gastoReposicao)}
                  negative
                  colors={colors}
                />
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
                <KpiRow
                  label="Lucro operacional"
                  value={formatCurrency(current.lucroOperacional)}
                  bold
                  colors={colors}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

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
    <View style={styles.barWrap}>
      <View
        style={[
          styles.bar,
          {
            height: Math.max(height, 2),
            backgroundColor: color,
          },
        ]}
      />
      {label !== '' && (
        <Text
          style={[styles.barLabel, { color: colors.textMuted }]}
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
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function KpiRow({
  label,
  value,
  bold,
  negative,
  colors,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.kpiRow}>
      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.kpiValue,
          {
            color: colors.textPrimary,
            fontWeight: bold ? '700' : '500',
          },
        ]}
      >
        {negative ? '− ' : ''}
        {value}
      </Text>
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
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
  loading: { marginTop: SPACING.xxl },
  headlineCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  headlineLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  headlineValue: { fontSize: 32, fontWeight: '700' },
  chartCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  chartTitle: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  chartSub: { fontSize: FONT_SIZE.xs },
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
  kpiCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  kpiTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: { fontSize: FONT_SIZE.sm },
  kpiValue: { fontSize: FONT_SIZE.sm },
  divider: { height: 1, marginVertical: SPACING.xs },
});
