import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { relatoriosService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { RelatorioV2Response, RelatorioTopProduto } from '@/types';

// ─── Date helpers ────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDMY(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

type ChipId = 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'mes_ant' | 'ano';

interface ChipDef {
  id: ChipId;
  label: string;
}

const CHIPS: ChipDef[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'mes', label: 'Mês' },
  { id: 'mes_ant', label: 'Mês ant.' },
  { id: 'ano', label: 'Ano' },
];

function getRangeForChip(chip: ChipId): { from: string; to: string } {
  const now = new Date();
  const today = toYMD(now);

  switch (chip) {
    case 'hoje':
      return { from: today, to: today };

    case 'ontem': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const s = toYMD(y);
      return { from: s, to: s };
    }

    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: toYMD(s), to: today };
    }

    case '30d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { from: toYMD(s), to: today };
    }

    case 'mes': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toYMD(s), to: today };
    }

    case 'mes_ant': {
      const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toYMD(firstOfPrev), to: toYMD(lastOfPrev) };
    }

    case 'ano': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { from: toYMD(s), to: today };
    }
  }
}

// ─── Delta helpers ────────────────────────────────────────────────────────────

interface Delta {
  text: string;
  positive: boolean | null; // null = neutral
}

function calcDeltaPct(atual: number, anterior: number): Delta {
  if (anterior === 0 && atual === 0) return { text: '—', positive: null };
  if (anterior === 0 && atual > 0) return { text: 'novo', positive: true };
  if (anterior === 0 && atual < 0) return { text: 'novo', positive: false };
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

function calcDeltaPts(atual: number, anterior: number): Delta {
  const diff = atual - anterior;
  if (diff === 0) return { text: '—', positive: null };
  const sign = diff > 0 ? '+' : '';
  return { text: `${sign}${diff.toFixed(1)}pp`, positive: diff >= 0 };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof useTheme>['colors'];

type TopTab = 'lucro' | 'bruto';

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ delta, colors }: { delta: Delta; colors: ThemeColors }) {
  const color =
    delta.positive === null
      ? colors.textMuted
      : delta.positive
        ? colors.success
        : colors.error;
  return (
    <Text style={[deltaStyles.text, { color }]}>
      {delta.text} ant.
    </Text>
  );
}

const deltaStyles = StyleSheet.create({
  text: { fontSize: 10, marginTop: 2 },
});

function KpiCard({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  delta,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  delta: Delta;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        kpiCardStyles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={[kpiCardStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[kpiCardStyles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <DeltaBadge delta={delta} colors={colors} />
    </View>
  );
}

const kpiCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 2,
    minHeight: 96,
  },
  label: { fontSize: 10, marginTop: 2 },
  value: { fontSize: FONT_SIZE.md, fontWeight: '700', marginTop: 2 },
});

function TopProductItem({
  produto,
  rank,
  tab,
  colors,
  router,
}: {
  produto: RelatorioTopProduto;
  rank: number;
  tab: TopTab;
  colors: ThemeColors;
  router: ReturnType<typeof useRouter>;
}) {
  const lucroColor = produto.lucro >= 0 ? colors.success : colors.error;

  const handlePress = useCallback(() => {
    if (produto.productId) {
      router.push(`/produtos/${produto.productId}` as unknown as never);
    } else if (produto.mlListingId) {
      void Linking.openURL(
        `https://produto.mercadolivre.com.br/${produto.mlListingId}`,
      );
    }
  }, [produto.productId, produto.mlListingId, router]);

  const isActionable = Boolean(produto.productId || produto.mlListingId);

  const Wrapper = isActionable ? TouchableOpacity : View;
  const wrapperProps = isActionable ? { onPress: handlePress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...(wrapperProps as object)}
      style={[
        topItemStyles.container,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <View style={[topItemStyles.rank, { backgroundColor: colors.background }]}>
        <Text style={[topItemStyles.rankText, { color: colors.textPrimary }]}>
          {rank}
        </Text>
      </View>
      <View style={topItemStyles.info}>
        <Text
          style={[topItemStyles.name, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {produto.name}
        </Text>
        {produto.variation ? (
          <Text style={[topItemStyles.variation, { color: colors.textMuted }]}>
            {produto.variation}
          </Text>
        ) : null}
        <Text style={[topItemStyles.metaLine, { color: colors.textSecondary }]}>
          {produto.vendas} un · Bruto {formatCurrency(produto.bruto)}
        </Text>
        <Text style={topItemStyles.metaLine}>
          <Text style={{ color: lucroColor }}>
            Lucro {formatCurrency(produto.lucro)}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {' · '}
            {tab === 'lucro' ? `margem ${produto.margem.toFixed(1)}%` : `bruto destaque`}
          </Text>
        </Text>
      </View>
    </Wrapper>
  );
}

const topItemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: { fontSize: 11, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 18 },
  variation: { fontSize: FONT_SIZE.xs },
  metaLine: { fontSize: FONT_SIZE.xs, lineHeight: 16 },
});

// ─── Chart ────────────────────────────────────────────────────────────────────

function LucroChart({
  timeline,
  colors,
}: {
  timeline: RelatorioV2Response['timeline'];
  colors: ThemeColors;
}) {
  const PLOT_HEIGHT = 150;
  const MIN_BAR = 2;

  const hasData = timeline.some((t) => t.lucro !== 0);

  if (!hasData) {
    return (
      <View style={chartStyles.empty}>
        <Text style={[chartStyles.emptyText, { color: colors.textMuted }]}>
          Sem dados no período
        </Text>
      </View>
    );
  }

  const maxAbs = Math.max(...timeline.map((t) => Math.abs(t.lucro)), 1);
  const count = timeline.length;
  // For many points, bars are thin; for few, medium
  const isMany = count > 14;

  return (
    <View>
      <View style={[chartStyles.plotArea, { height: PLOT_HEIGHT }]}>
        {timeline.map((point) => {
          const absRatio = Math.abs(point.lucro) / maxAbs;
          const barH = Math.max(absRatio * (PLOT_HEIGHT / 2 - 4), MIN_BAR);
          const barColor = point.lucro >= 0 ? colors.success : colors.error;
          // Positive bars grow up from midline, negative grow down
          return (
            <View key={point.date} style={chartStyles.barSlot}>
              {point.lucro >= 0 ? (
                <>
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View
                      style={[
                        chartStyles.bar,
                        {
                          height: barH,
                          backgroundColor: barColor,
                          width: isMany ? 4 : 10,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        },
                      ]}
                    />
                  </View>
                  <View style={[chartStyles.midline, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1 }} />
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }} />
                  <View style={[chartStyles.midline, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1, justifyContent: 'flex-start' }}>
                    <View
                      style={[
                        chartStyles.bar,
                        {
                          height: barH,
                          backgroundColor: barColor,
                          width: isMany ? 4 : 10,
                          borderBottomLeftRadius: 2,
                          borderBottomRightRadius: 2,
                        },
                      ]}
                    />
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* X-axis date labels — always show first / mid / last */}
      {count > 1 && (
        <View style={chartStyles.xAxisSpaced}>
          {([timeline[0], timeline[Math.floor((count - 1) / 2)], timeline[count - 1]] as Array<RelatorioV2Response['timeline'][number] | undefined>).map(
            (point, i) => {
              if (!point) return null;
              const parts = point.date.split('-');
              const label = `${parts[2]}/${parts[1]}`;
              return (
                <Text
                  key={`xaxis-${i}-${point.date}`}
                  style={[chartStyles.xLabel, { color: colors.textMuted }]}
                >
                  {label}
                </Text>
              );
            },
          )}
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  plotArea: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 2,
  },
  barSlot: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  bar: {
    minHeight: 2,
  },
  midline: {
    height: 1,
    width: '100%',
  },
  xAxis: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  xAxisSpaced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  xLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  empty: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RelatoriosScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [activeChip, setActiveChip] = useState<ChipId>('hoje');
  const [data, setData] = useState<RelatorioV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topTab, setTopTab] = useState<TopTab>('lucro');

  const range = useMemo(() => getRangeForChip(activeChip), [activeChip]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      const res = await relatoriosService.v2(range.from, range.to);
      if (res.success) {
        setData(res.data);
      } else {
        toast.error('Erro ao carregar relatório', res.error);
      }
      if (!isRefresh) setLoading(false);
    },
    [range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // KPI deltas — memoized
  const kpiDeltas = useMemo(() => {
    if (!data) return null;
    return {
      lucro: calcDeltaPct(data.kpisAtual.lucro, data.kpisAnterior.lucro),
      margem: calcDeltaPts(
        data.derivados.margemPct,
        data.derivados.margemPctAnterior,
      ),
      bruto: calcDeltaPct(data.kpisAtual.bruto, data.kpisAnterior.bruto),
      pedidos: calcDeltaPct(
        data.kpisAtual.pedidos,
        data.kpisAnterior.pedidos,
      ),
    };
  }, [data]);

  const topProdutos = useMemo(() => {
    if (!data) return [];
    return topTab === 'lucro' ? data.topPorLucro : data.topPorBruto;
  }, [data, topTab]);

  // Show chart only when timeline has > 1 point
  const showChart = useMemo(() => {
    return (data?.timeline?.length ?? 0) > 1;
  }, [data]);

  const rangeLabel = `${formatDMY(range.from)} → ${formatDMY(range.to)}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerIcon}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Relatórios
        </Text>
        <View style={styles.headerIcon} />
      </View>

      {/* Period chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}
      >
        {CHIPS.map((chip) => {
          const isActive = chip.id === activeChip;
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => setActiveChip(chip.id)}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Range label */}
      <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>
        {rangeLabel}
      </Text>

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
            style={styles.loadingIndicator}
          />
        ) : data && kpiDeltas ? (
          <>
            {/* KPI grid 2x2 */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiRow}>
                <KpiCard
                  icon="trending-up-outline"
                  iconColor={
                    data.kpisAtual.lucro >= 0 ? colors.success : colors.error
                  }
                  label="Lucro"
                  value={formatCurrency(data.kpisAtual.lucro)}
                  valueColor={
                    data.kpisAtual.lucro >= 0 ? colors.success : colors.error
                  }
                  delta={kpiDeltas.lucro}
                  colors={colors}
                />
                <KpiCard
                  icon="pie-chart-outline"
                  iconColor={colors.primary}
                  label="Margem"
                  value={`${data.derivados.margemPct.toFixed(1)}%`}
                  valueColor={colors.textPrimary}
                  delta={kpiDeltas.margem}
                  colors={colors}
                />
              </View>
              <View style={styles.kpiRow}>
                <KpiCard
                  icon="cash-outline"
                  iconColor={colors.success}
                  label="Bruto"
                  value={formatCurrency(data.kpisAtual.bruto)}
                  valueColor={colors.textPrimary}
                  delta={kpiDeltas.bruto}
                  colors={colors}
                />
                <KpiCard
                  icon="receipt-outline"
                  iconColor={colors.info}
                  label="Pedidos"
                  value={String(data.kpisAtual.pedidos)}
                  valueColor={colors.textPrimary}
                  delta={kpiDeltas.pedidos}
                  colors={colors}
                />
              </View>
            </View>

            {/* Cancelamentos warning (only if > 0) */}
            {data.cancelamentos.vendas > 0 && (
              <View style={styles.cancelRow}>
                <Ionicons name="warning-outline" size={14} color={colors.error} />
                <Text style={[styles.cancelText, { color: colors.error }]}>
                  {data.cancelamentos.vendas}{' '}
                  {data.cancelamentos.vendas === 1
                    ? 'venda cancelada'
                    : 'vendas canceladas'}{' '}
                  · {formatCurrency(data.cancelamentos.bruto)} (
                  {data.cancelamentos.taxaPct.toFixed(1)}% do bruto)
                </Text>
              </View>
            )}

            {/* Chart card */}
            {showChart && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Lucro por dia
                </Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {data.timeline.length} dias
                </Text>
                <View style={styles.chartWrap}>
                  <LucroChart timeline={data.timeline} colors={colors} />
                </View>
              </View>
            )}

            {/* Top produtos */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.topHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Top produtos
                </Text>
                <View style={styles.segmented}>
                  <TouchableOpacity
                    style={[
                      styles.segBtn,
                      topTab === 'lucro'
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
                    ]}
                    onPress={() => setTopTab('lucro')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        { color: topTab === 'lucro' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Por Lucro
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segBtn,
                      topTab === 'bruto'
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
                    ]}
                    onPress={() => setTopTab('bruto')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        { color: topTab === 'bruto' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Por Bruto
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {topProdutos.length === 0 ? (
                <Text style={[styles.emptyTop, { color: colors.textMuted }]}>
                  Nenhuma venda no período
                </Text>
              ) : (
                <View style={styles.topList}>
                  {topProdutos.map((p, idx) => (
                    <TopProductItem
                      key={`${p.productId ?? p.mlListingId ?? p.name}-${idx}`}
                      produto={p}
                      rank={idx + 1}
                      tab={topTab}
                      colors={colors}
                      router={router}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : !loading ? (
          <Text style={[styles.emptyTop, { color: colors.textMuted }]}>
            Sem dados para exibir
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerIcon: { padding: SPACING.sm, minWidth: 42 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },

  // Chips
  chipsScroll: { flexGrow: 0 },
  chipsContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },

  // Range label
  rangeLabel: {
    fontSize: 11,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },

  // Scroll content
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  loadingIndicator: { marginTop: SPACING.xxl },

  // KPI grid
  kpiGrid: { gap: SPACING.sm },
  kpiRow: { flexDirection: 'row', gap: SPACING.sm },

  // Cancelamentos
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  cancelText: { fontSize: FONT_SIZE.xs, flex: 1 },

  // Cards
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  cardSub: { fontSize: FONT_SIZE.xs, marginTop: -SPACING.xs },

  // Chart
  chartWrap: { marginTop: SPACING.xs },

  // Top produtos
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  segmented: { flexDirection: 'row', gap: SPACING.xs },
  segBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  segBtnText: { fontSize: 11, fontWeight: '600' },
  topList: { gap: SPACING.sm },
  emptyTop: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
