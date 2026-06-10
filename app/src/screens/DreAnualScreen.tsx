import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
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
import type {
  DreAnualResponse,
  DreBasis,
  DreResult,
} from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MONTH_LABELS_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function isEmptyMonth(dre: DreResult): boolean {
  return (
    dre.receitaBruta === 0 &&
    dre.totalDespesas === 0 &&
    dre.cmv === 0 &&
    dre.totalTaxas === 0
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  total,
  year,
  colors,
}: {
  total: DreResult;
  year: number;
  colors: ThemeColors;
}) {
  const lucroColor = total.lucroLiquido >= 0 ? colors.success : colors.error;
  const margemColor =
    total.margemLiquidaPct >= 0 ? colors.success : colors.error;

  return (
    <View
      style={[
        summaryStyles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <View style={summaryStyles.header}>
        <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
        <Text style={[summaryStyles.title, { color: colors.textPrimary }]}>
          Resumo {year}
        </Text>
      </View>

      <View style={summaryStyles.row}>
        <View style={summaryStyles.col}>
          <Text style={[summaryStyles.label, { color: colors.textMuted }]}>
            Receita Bruta
          </Text>
          <Text style={[summaryStyles.value, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(total.receitaBruta)}
          </Text>
        </View>
        <View style={summaryStyles.col}>
          <Text style={[summaryStyles.label, { color: colors.textMuted }]}>
            Receita Líquida
          </Text>
          <Text style={[summaryStyles.value, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(total.receitaLiquida)}
          </Text>
        </View>
      </View>

      <View style={summaryStyles.row}>
        <View style={summaryStyles.col}>
          <Text style={[summaryStyles.label, { color: colors.textMuted }]}>
            Lucro Bruto
          </Text>
          <Text style={[summaryStyles.value, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(total.lucroBruto)}
          </Text>
        </View>
        <View style={summaryStyles.col}>
          <Text style={[summaryStyles.label, { color: colors.textMuted }]}>
            Lucro Líquido
          </Text>
          <Text style={[summaryStyles.value, { color: lucroColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(total.lucroLiquido)}
          </Text>
        </View>
      </View>

      <View style={[summaryStyles.marginRow, { borderTopColor: colors.border }]}>
        <Text style={[summaryStyles.label, { color: colors.textMuted }]}>
          Margem líquida
        </Text>
        <Text style={[summaryStyles.margin, { color: margemColor }]}>
          {total.margemLiquidaPct.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  row: { flexDirection: 'row', gap: SPACING.md },
  col: { flex: 1, gap: 2 },
  label: { fontSize: 11 },
  value: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  margin: { fontSize: FONT_SIZE.md, fontWeight: '700' },
});

function DetailRow({
  label,
  value,
  colors,
  bold = false,
  highlight = 'none',
  small = false,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  bold?: boolean;
  highlight?: 'none' | 'positive' | 'negative';
  small?: boolean;
}) {
  const valueColor =
    highlight === 'positive'
      ? colors.success
      : highlight === 'negative'
        ? colors.error
        : colors.textPrimary;
  return (
    <View style={detailRowStyles.row}>
      <Text
        style={[
          detailRowStyles.label,
          { color: colors.textSecondary, fontSize: small ? 12 : FONT_SIZE.sm },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={[
          detailRowStyles.value,
          {
            color: valueColor,
            fontWeight: bold ? '700' : '500',
            fontSize: small ? 12 : FONT_SIZE.sm,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 3,
  },
  label: { flex: 1 },
  value: { textAlign: 'right' },
});

function MonthCard({
  monthIdx,
  dre,
  expanded,
  onToggle,
  colors,
}: {
  monthIdx: number;
  dre: DreResult;
  expanded: boolean;
  onToggle: () => void;
  colors: ThemeColors;
}) {
  const empty = isEmptyMonth(dre);
  const lucroColor = dre.lucroLiquido >= 0 ? colors.success : colors.error;
  const margemColor =
    dre.margemLiquidaPct >= 0 ? colors.success : colors.error;

  return (
    <View
      style={[
        monthStyles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        activeOpacity={empty ? 1 : 0.7}
        onPress={empty ? undefined : onToggle}
        style={monthStyles.header}
      >
        <View style={monthStyles.headerLeft}>
          <Text style={[monthStyles.month, { color: colors.textPrimary }]}>
            {MONTH_LABELS_LONG[monthIdx]}
          </Text>
          {empty ? (
            <Text style={[monthStyles.emptyTag, { color: colors.textMuted }]}>
              sem movimentação
            </Text>
          ) : (
            <Text style={[monthStyles.subline, { color: colors.textMuted }]}>
              Receita {formatCurrency(dre.receitaLiquida)}
            </Text>
          )}
        </View>
        {!empty && (
          <View style={monthStyles.headerRight}>
            <Text style={[monthStyles.lucro, { color: lucroColor }]} numberOfLines={1}>
              {formatCurrency(dre.lucroLiquido)}
            </Text>
            <Text style={[monthStyles.margem, { color: margemColor }]}>
              {dre.margemLiquidaPct.toFixed(1)}%
            </Text>
          </View>
        )}
        {!empty && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
            style={monthStyles.chevron}
          />
        )}
      </TouchableOpacity>

      {expanded && !empty && (
        <View style={[monthStyles.body, { borderTopColor: colors.border }]}>
          {/* Receitas */}
          <Text style={[monthStyles.section, { color: colors.textMuted }]}>
            RECEITAS
          </Text>
          <DetailRow
            label="Receita Bruta ML"
            value={formatCurrency(dre.receitaBrutaML)}
            colors={colors}
          />
          {dre.receitaBrutaOutras !== 0 && (
            <DetailRow
              label="Outras receitas"
              value={formatCurrency(dre.receitaBrutaOutras)}
              colors={colors}
            />
          )}
          <DetailRow
            label="Receita Bruta total"
            value={formatCurrency(dre.receitaBruta)}
            colors={colors}
            bold
          />

          {/* Taxas */}
          {(dre.taxaVendaML !== 0 || dre.taxaEnvioML !== 0) && (
            <>
              <Text style={[monthStyles.section, { color: colors.textMuted }]}>
                TAXAS ML
              </Text>
              {dre.taxaVendaML !== 0 && (
                <DetailRow
                  label="(-) Taxa de venda"
                  value={`-${formatCurrency(dre.taxaVendaML)}`}
                  colors={colors}
                  highlight="negative"
                />
              )}
              {dre.taxaEnvioML !== 0 && (
                <DetailRow
                  label="(-) Taxa de envio"
                  value={`-${formatCurrency(dre.taxaEnvioML)}`}
                  colors={colors}
                  highlight="negative"
                />
              )}
            </>
          )}

          <DetailRow
            label="Receita Líquida"
            value={formatCurrency(dre.receitaLiquida)}
            colors={colors}
            bold
          />

          {/* CMV + Lucro bruto */}
          {dre.cmv !== 0 && (
            <DetailRow
              label="(-) CMV"
              value={`-${formatCurrency(dre.cmv)}`}
              colors={colors}
              highlight="negative"
            />
          )}
          <DetailRow
            label="Lucro Bruto"
            value={formatCurrency(dre.lucroBruto)}
            colors={colors}
            bold
            highlight={dre.lucroBruto >= 0 ? 'positive' : 'negative'}
          />

          {/* Despesas por categoria */}
          {dre.despesasPorCategoria.length > 0 && (
            <>
              <Text style={[monthStyles.section, { color: colors.textMuted }]}>
                DESPESAS
              </Text>
              {dre.despesasPorCategoria.map((cat) => (
                <DetailRow
                  key={cat.name}
                  label={cat.name}
                  value={`-${formatCurrency(cat.total)}`}
                  colors={colors}
                  small
                />
              ))}
              <DetailRow
                label="(-) Total despesas"
                value={`-${formatCurrency(dre.totalDespesas)}`}
                colors={colors}
                bold
                highlight="negative"
              />
            </>
          )}

          {/* Lucro líquido */}
          <View
            style={[
              monthStyles.totalRow,
              { borderTopColor: colors.border, marginTop: SPACING.xs },
            ]}
          >
            <Text style={[monthStyles.totalLabel, { color: colors.textPrimary }]}>
              Lucro Líquido
            </Text>
            <View style={monthStyles.totalRight}>
              <Text style={[monthStyles.totalValue, { color: lucroColor }]}>
                {formatCurrency(dre.lucroLiquido)}
              </Text>
              <Text style={[monthStyles.totalMargin, { color: margemColor }]}>
                margem {dre.margemLiquidaPct.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const monthStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  month: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  subline: { fontSize: FONT_SIZE.xs },
  emptyTag: { fontSize: FONT_SIZE.xs, fontStyle: 'italic' },
  lucro: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  margem: { fontSize: 11, fontWeight: '600' },
  chevron: { marginLeft: SPACING.xs },
  body: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    gap: 2,
  },
  section: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  totalLabel: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  totalRight: { alignItems: 'flex-end' },
  totalValue: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  totalMargin: { fontSize: 11, fontWeight: '600' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DreAnualScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [basis, setBasis] = useState<DreBasis>('competencia');
  const [data, setData] = useState<DreAnualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      const res = await relatoriosService.dreAnual(year, basis);
      if (res.success) {
        setData(res.data);
      } else {
        toast.error('Erro ao carregar DRE anual', res.error);
      }
      if (!isRefresh) setLoading(false);
    },
    [year, basis],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const toggleMonth = useCallback((monthIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMonth((prev) => (prev === monthIdx ? null : monthIdx));
  }, []);

  const availableYears = useMemo(() => {
    if (data?.availableYears.length) return data.availableYears;
    return [new Date().getFullYear()];
  }, [data]);

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
          DRE Anual
        </Text>
        <View style={styles.headerIcon} />
      </View>

      {/* Year chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}
      >
        {availableYears.map((y) => {
          const isActive = y === year;
          return (
            <TouchableOpacity
              key={y}
              onPress={() => setYear(y)}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: colors.primary }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {y}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Basis toggle */}
      <View style={styles.basisRow}>
        <View style={styles.segmented}>
          {(['competencia', 'caixa'] as DreBasis[]).map((b) => {
            const isActive = b === basis;
            return (
              <TouchableOpacity
                key={b}
                onPress={() => setBasis(b)}
                style={[
                  styles.segBtn,
                  isActive
                    ? { backgroundColor: colors.primary }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segBtnText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {b === 'competencia' ? 'Competência' : 'Caixa'}
                </Text>
              </TouchableOpacity>
            );
          })}
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
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loadingIndicator}
          />
        ) : data ? (
          <>
            <SummaryCard total={data.total} year={data.year} colors={colors} />

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              POR MÊS
            </Text>

            <View style={styles.monthList}>
              {data.months.map(({ month, dre }) => (
                <MonthCard
                  key={month}
                  monthIdx={month - 1}
                  dre={dre}
                  expanded={expandedMonth === month - 1}
                  onToggle={() => toggleMonth(month - 1)}
                  colors={colors}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Sem dados para exibir
          </Text>
        )}
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

  // Year chips
  chipsScroll: { flexGrow: 0 },
  chipsContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  chipText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // Basis toggle
  basisRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  segmented: { flexDirection: 'row', gap: SPACING.xs },
  segBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  segBtnText: { fontSize: 11, fontWeight: '600' },

  // Content
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  loadingIndicator: { marginTop: SPACING.xxl },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: SPACING.xs,
  },
  monthList: { gap: SPACING.sm },
  empty: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.xxl,
  },
});
