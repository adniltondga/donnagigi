import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { billsService, relatoriosService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import {
  computeBillInPack,
  computeSaleNumbers,
  parseSaleDescription,
} from '@/utils/saleNotes';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Bill, RelatorioKPIs } from '@/types';

const PAGE_SIZE = 30;

/** YYYY-MM-DD em fuso local, com offset em dias (0=hoje, -1=ontem). */
function dateBR(dayOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DayKey = 'today' | 'yesterday';
const DAY_OFFSET: Record<DayKey, number> = { today: 0, yesterday: -1 };

LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ],
  dayNames: [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
  ],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

/** Converte YYYY-MM-DD pra DD/MM curto. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function timeOf(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Achata bills agrupando packs consecutivos (mesma lógica do web em
// vendas-ml/page.tsx). Quando o pack tá colapsado, só renderiza o header;
// quando expandido, header + filhos.
type Row =
  | { kind: 'single'; key: string; bill: Bill }
  | {
      kind: 'pack-header';
      key: string;
      packId: string;
      bills: Bill[];
      expanded: boolean;
    }
  | { kind: 'pack-child'; key: string; bill: Bill; packBills: Bill[] };

function buildRows(bills: Bill[], expanded: Set<string>): Row[] {
  const rows: Row[] = [];
  let i = 0;
  while (i < bills.length) {
    const b = bills[i];
    if (!b.mlPackId) {
      rows.push({ kind: 'single', key: b.id, bill: b });
      i++;
      continue;
    }
    let j = i + 1;
    while (j < bills.length && bills[j].mlPackId === b.mlPackId) j++;
    if (j - i === 1) {
      rows.push({ kind: 'single', key: b.id, bill: b });
      i++;
    } else {
      const group = bills.slice(i, j);
      const isOpen = expanded.has(b.mlPackId);
      rows.push({
        kind: 'pack-header',
        key: `pack-${b.mlPackId}`,
        packId: b.mlPackId,
        bills: group,
        expanded: isOpen,
      });
      if (isOpen) {
        for (const child of group) {
          rows.push({
            kind: 'pack-child',
            key: `child-${child.id}`,
            bill: child,
            packBills: group,
          });
        }
      }
      i = j;
    }
  }
  return rows;
}

export default function VendasScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<Bill[]>([]);
  const [kpis, setKpis] = useState<RelatorioKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<DayKey>('today');
  // Data custom escolhida no calendário. Quando definida, prevalece sobre
  // o segmento Hoje/Ontem. Limpar = voltar pro segmento ativo.
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = dateBR(0);
  const activeDate = customDate ?? dateBR(DAY_OFFSET[day]);
  const isCustom = customDate !== null;

  const load = useCallback(async () => {
    const dia = activeDate;
    const [billsRes, kpisRes] = await Promise.all([
      billsService.list({
        type: 'receivable',
        category: 'venda',
        paidFrom: dia,
        paidTo: dia,
        orderBy: 'paidDate_desc',
        limit: PAGE_SIZE,
      }),
      relatoriosService.v2(dia, dia),
    ]);

    if (billsRes.success) {
      setItems(billsRes.data.data);
    } else {
      toast.error('Erro ao carregar', billsRes.error);
    }

    if (kpisRes.success) {
      setKpis(kpisRes.data.kpisAtual);
    }
  }, [activeDate]);

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

  const rows = useMemo(() => buildRows(items, expandedPacks), [
    items,
    expandedPacks,
  ]);

  const togglePack = useCallback((packId: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }, []);

  const openBill = useCallback(
    (id: string) => {
      router.push({ pathname: '/contas/[id]', params: { id } } as never);
    },
    [router],
  );

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

        <View
          style={[
            styles.segment,
            {
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
        >
          {(['today', 'yesterday'] as DayKey[]).map((k) => {
            const active = !isCustom && day === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => {
                  setCustomDate(null);
                  setDay(k);
                }}
                activeOpacity={0.7}
                style={[
                  styles.segmentBtn,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: active ? '#fff' : colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {k === 'today' ? 'Hoje' : 'Ontem'}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setCalendarOpen(true)}
            activeOpacity={0.7}
            style={[
              styles.segmentBtn,
              styles.segmentBtnIcon,
              isCustom && { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={isCustom ? '#fff' : colors.textSecondary}
            />
            {isCustom ? (
              <Text
                style={[
                  styles.segmentText,
                  { color: '#fff', fontWeight: '700', marginLeft: 4 },
                ]}
              >
                {shortDate(activeDate)}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            kpis ? (
              <View
                style={[
                  styles.kpiBox,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <KpiItem
                  label="Bruto"
                  value={formatCurrency(kpis.bruto)}
                  color={colors.textPrimary}
                  colors={colors}
                />
                <View
                  style={[styles.kpiDiv, { backgroundColor: colors.border }]}
                />
                <KpiItem
                  label="Lucro"
                  value={formatCurrency(kpis.lucro)}
                  color={kpis.lucro >= 0 ? colors.success : colors.error}
                  colors={colors}
                />
                <View
                  style={[styles.kpiDiv, { backgroundColor: colors.border }]}
                />
                <KpiItem
                  label="Pedidos"
                  value={`${kpis.pedidos}`}
                  color={colors.textPrimary}
                  colors={colors}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {isCustom
                  ? `Nenhuma venda em ${shortDate(activeDate)}`
                  : day === 'today'
                  ? 'Nenhuma venda hoje'
                  : 'Nenhuma venda ontem'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'single') {
              return (
                <SingleRow
                  bill={item.bill}
                  onPress={() => openBill(item.bill.id)}
                  colors={colors}
                />
              );
            }
            if (item.kind === 'pack-header') {
              return (
                <PackHeaderRow
                  packId={item.packId}
                  bills={item.bills}
                  expanded={item.expanded}
                  onPress={() => togglePack(item.packId)}
                  colors={colors}
                />
              );
            }
            return (
              <PackChildRow
                bill={item.bill}
                packBills={item.packBills}
                onPress={() => openBill(item.bill.id)}
                colors={colors}
              />
            );
          }}
        />
      )}

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          onPress={() => setCalendarOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Escolha um dia
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={activeDate}
              maxDate={today}
              onDayPress={(d) => {
                const picked = d.dateString;
                // Se escolheu hoje ou ontem, prefere o estado limpo (segmento)
                if (picked === dateBR(0)) {
                  setCustomDate(null);
                  setDay('today');
                } else if (picked === dateBR(-1)) {
                  setCustomDate(null);
                  setDay('yesterday');
                } else {
                  setCustomDate(picked);
                }
                setCalendarOpen(false);
              }}
              markedDates={{
                [activeDate]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={{
                calendarBackground: colors.backgroundCard,
                dayTextColor: colors.textPrimary,
                textDisabledColor: colors.textMuted + '66',
                monthTextColor: colors.textPrimary,
                arrowColor: colors.primary,
                todayTextColor: colors.primary,
                textSectionTitleColor: colors.textMuted,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#fff',
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function KpiItem({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function lucroColor(lucro: number, colors: ThemeColors): string {
  if (lucro > 0) return colors.success;
  if (lucro < 0) return colors.error;
  return colors.textMuted;
}

function lucroLabel(lucro: number): string {
  const sign = lucro > 0 ? '+' : lucro < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(lucro))}`;
}

function rowTitle(bill: Bill): string {
  const { title } = parseSaleDescription(bill.description);
  return title || bill.description;
}

function CancelBadge({ colors }: { colors: ThemeColors }) {
  return (
    <View
      style={[
        styles.cancelBadge,
        { backgroundColor: colors.error + '22', borderColor: colors.error + '55' },
      ]}
    >
      <Text style={[styles.cancelBadgeText, { color: colors.error }]}>
        Cancelado
      </Text>
    </View>
  );
}

function SingleRow({
  bill,
  onPress,
  colors,
}: {
  bill: Bill;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const s = computeSaleNumbers(bill);
  const time = timeOf(bill.paidDate);
  const cancelled = bill.status === 'cancelled';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: cancelled ? colors.error + '55' : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: cancelled
              ? colors.error + '1F'
              : colors.success + '1F',
          },
        ]}
      >
        <Ionicons
          name={cancelled ? 'close-circle-outline' : 'cart-outline'}
          size={18}
          color={cancelled ? colors.error : colors.success}
        />
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowDesc, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {rowTitle(bill)}
        </Text>
        <View style={styles.rowMetaLine}>
          {time ? (
            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
              {time}
            </Text>
          ) : null}
          {cancelled ? <CancelBadge colors={colors} /> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowAmount,
            {
              color: cancelled ? colors.textMuted : colors.textPrimary,
              textDecorationLine: cancelled ? 'line-through' : 'none',
            },
          ]}
        >
          {formatCurrency(s.bruto)}
        </Text>
        {!cancelled ? (
          <Text
            style={[styles.rowLucro, { color: lucroColor(s.lucro, colors) }]}
          >
            {lucroLabel(s.lucro)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function PackHeaderRow({
  packId,
  bills,
  expanded,
  onPress,
  colors,
}: {
  packId: string;
  bills: Bill[];
  expanded: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  // Soma usa computeSaleNumbers (não rateado): o total do pack é a soma dos
  // valores reais — o rateio só faz sentido por filho.
  const totals = bills.reduce(
    (acc, b) => {
      const s = computeSaleNumbers(b);
      acc.bruto += s.bruto;
      acc.lucro += s.lucro;
      return acc;
    },
    { bruto: 0, lucro: 0 },
  );
  const time = timeOf(bills[0]?.paidDate);
  const packShort = packId.length > 6 ? `#…${packId.slice(-6)}` : `#${packId}`;
  const allCancelled = bills.every((b) => b.status === 'cancelled');
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: allCancelled ? colors.error + '55' : colors.primary + '40',
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: allCancelled
              ? colors.error + '1F'
              : colors.primary + '1F',
          },
        ]}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={allCancelled ? colors.error : colors.primary}
        />
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowDesc, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          Pack com {bills.length} produtos
        </Text>
        <View style={styles.rowMetaLine}>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            {time ? `${time} • ` : ''}
            {packShort}
          </Text>
          {allCancelled ? <CancelBadge colors={colors} /> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowAmount,
            {
              color: allCancelled ? colors.textMuted : colors.textPrimary,
              textDecorationLine: allCancelled ? 'line-through' : 'none',
            },
          ]}
        >
          {formatCurrency(totals.bruto)}
        </Text>
        {!allCancelled ? (
          <Text
            style={[
              styles.rowLucro,
              { color: lucroColor(totals.lucro, colors) },
            ]}
          >
            {lucroLabel(totals.lucro)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function PackChildRow({
  bill,
  packBills,
  onPress,
  colors,
}: {
  bill: Bill;
  packBills: Bill[];
  onPress: () => void;
  colors: ThemeColors;
}) {
  const s = computeBillInPack(bill, packBills);
  const cancelled = bill.status === 'cancelled';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.childRow,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: cancelled ? colors.error + '55' : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.childBar,
          {
            backgroundColor: cancelled
              ? colors.error + '80'
              : colors.primary + '60',
          },
        ]}
      />
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowDesc, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {rowTitle(bill)}
        </Text>
        <View style={styles.rowMetaLine}>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            frete rateado {formatCurrency(s.envio)}
          </Text>
          {cancelled ? <CancelBadge colors={colors} /> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowAmount,
            {
              color: cancelled ? colors.textMuted : colors.textPrimary,
              textDecorationLine: cancelled ? 'line-through' : 'none',
            },
          ]}
        >
          {formatCurrency(s.bruto)}
        </Text>
        {!cancelled ? (
          <Text
            style={[styles.rowLucro, { color: lucroColor(s.lucro, colors) }]}
          >
            {lucroLabel(s.lucro)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
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
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 64,
    alignItems: 'center',
  },
  segmentBtnIcon: {
    minWidth: 0,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  segmentText: { fontSize: FONT_SIZE.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingBottom: SPACING.md,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg, gap: SPACING.sm },
  kpiBox: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiDiv: { width: 1 },
  kpiLabel: { fontSize: FONT_SIZE.xs },
  kpiValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT_SIZE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    paddingLeft: 0,
    marginLeft: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  childBar: { width: 3, alignSelf: 'stretch' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowDesc: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 18 },
  rowMeta: { fontSize: FONT_SIZE.xs },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowRight: { alignItems: 'flex-end', gap: 2, minWidth: 90 },
  rowAmount: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  rowLucro: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  cancelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  cancelBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
