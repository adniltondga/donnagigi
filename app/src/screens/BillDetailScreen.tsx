import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { billsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import { computeSaleNumbers, parseSaleDescription } from '@/utils/saleNotes';
import type { Bill } from '@/types';

interface Props {
  billId: string;
}

export default function BillDetailScreen({ billId }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await billsService.detail(billId);
    if (res.success) {
      setBill(res.data);
    } else {
      toast.error('Erro', res.error);
      router.back();
    }
  }, [billId, router]);

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

  const statusInfo = (() => {
    if (!bill) return { label: '—', color: colors.textMuted };
    if (bill.status === 'paid') {
      return {
        label: bill.type === 'receivable' ? 'Recebida' : 'Paga',
        color: colors.success,
      };
    }
    if (bill.status === 'cancelled')
      return { label: 'Cancelada', color: colors.textMuted };
    const due = new Date(bill.dueDate);
    due.setHours(23, 59, 59, 999);
    if (due.getTime() < Date.now())
      return { label: 'Vencida', color: colors.error };
    return { label: 'Pendente', color: colors.warning };
  })();

  const typeLabel =
    bill?.type === 'payable' ? 'Conta a pagar' : 'Conta a receber';

  const dueDateIsOverdue =
    bill &&
    bill.status !== 'paid' &&
    bill.status !== 'cancelled' &&
    (() => {
      const due = new Date(bill.dueDate);
      due.setHours(23, 59, 59, 999);
      return due.getTime() < Date.now();
    })();

  const isVenda = bill?.category === 'venda';

  const saleParsed = useMemo(
    () => (isVenda && bill ? parseSaleDescription(bill.description) : null),
    [isVenda, bill],
  );

  const sale = useMemo(
    () =>
      isVenda && bill
        ? computeSaleNumbers({
            amount: bill.amount,
            notes: bill.notes,
            productCost: bill.productCost,
            refundedAmount: bill.refundedAmount,
          })
        : null,
    [isVenda, bill],
  );

  const openMlOrder = useCallback((orderId: string) => {
    const url = `https://www.mercadolivre.com.br/vendas/${orderId}/detalhe`;
    void Linking.openURL(url).catch(() => toast.error('Não foi possível abrir o link'));
  }, []);

  const openMlListing = useCallback((mlb: string) => {
    const url = `https://produto.mercadolivre.com.br/${mlb}`;
    void Linking.openURL(url).catch(() => toast.error('Não foi possível abrir o link'));
  }, []);

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
          Detalhe da conta
        </Text>
        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !bill ? null : (
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
          {/* ── Hero do valor ── */}
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroMeta}>
              <Text style={[styles.heroType, { color: colors.textSecondary }]}>
                {typeLabel}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: statusInfo.color + '20' },
                ]}
              >
                <View
                  style={[styles.badgeDot, { backgroundColor: statusInfo.color }]}
                />
                <Text style={[styles.badgeLabel, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
              {formatCurrency(isVenda && sale ? sale.bruto : bill.amount)}
            </Text>
            {isVenda && sale ? (
              <Text style={[styles.heroCaption, { color: colors.textMuted }]}>
                Bruto · líquido {formatCurrency(sale.liquido)}
              </Text>
            ) : null}
          </View>

          {/* ── Descrição (ou Produto, quando venda) ── */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
              {isVenda ? 'Produto' : 'Descrição'}
            </Text>
            {isVenda && saleParsed ? (
              <>
                <Text style={[styles.cardText, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {saleParsed.title}
                </Text>
                {saleParsed.variation ? (
                  <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                    {saleParsed.variation}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.cardText, { color: colors.textPrimary }]}>
                {bill.description}
              </Text>
            )}
          </View>

          {/* ── Datas ── */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                {bill.type === 'payable' ? 'Vencimento' : 'Data prevista'}
              </Text>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color: dueDateIsOverdue ? colors.error : colors.textPrimary,
                    fontWeight: dueDateIsOverdue ? '700' : '600',
                  },
                ]}
              >
                {formatDate(bill.dueDate)}
              </Text>
            </View>
            {bill.status === 'paid' && bill.paidDate ? (
              <View style={[styles.row, styles.rowBordered, { borderColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  {bill.type === 'receivable' ? 'Recebida em' : 'Paga em'}
                </Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>
                  {formatDate(bill.paidDate)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Detalhamento da venda (só p/ category=venda) ── */}
          {isVenda && sale ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text
                  style={[styles.cardLabel, { color: colors.textSecondary }]}
                >
                  Detalhamento
                </Text>
                {bill.quantity && bill.quantity > 1 ? (
                  <View
                    style={[
                      styles.qtyPill,
                      { backgroundColor: colors.backgroundLight },
                    ]}
                  >
                    <Ionicons
                      name="cube-outline"
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.qtyPillText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {bill.quantity} un.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  Bruto
                </Text>
                <Text
                  style={[
                    styles.rowValue,
                    { color: colors.textPrimary, fontWeight: '700' },
                  ]}
                >
                  {formatCurrency(sale.bruto)}
                </Text>
              </View>

              {sale.taxaVenda > 0 ? (
                <View
                  style={[
                    styles.row,
                    styles.rowBordered,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Taxa de venda
                    {sale.saleFeeEstimated ? (
                      <Text style={[styles.estLabel, { color: colors.textMuted }]}>
                        {' '}(est.)
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    − {formatCurrency(sale.taxaVenda)}
                  </Text>
                </View>
              ) : null}

              {sale.envio > 0 ? (
                <View
                  style={[
                    styles.row,
                    sale.taxaVenda > 0
                      ? [styles.rowBordered, { borderColor: colors.border }]
                      : undefined,
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Taxa de envio
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    − {formatCurrency(sale.envio)}
                  </Text>
                </View>
              ) : null}

              {sale.shippingBonus > 0 ? (
                <View style={styles.subRow}>
                  <Text
                    style={[styles.subRowLabel, { color: colors.textMuted }]}
                  >
                    ↳ Bônus envio ML
                  </Text>
                  <Text style={[styles.subRowValue, { color: colors.success }]}>
                    +{formatCurrency(sale.shippingBonus)}
                  </Text>
                </View>
              ) : null}

              {sale.custo > 0 ? (
                <View
                  style={[
                    styles.row,
                    sale.taxaVenda > 0 || sale.envio > 0
                      ? [styles.rowBordered, { borderColor: colors.border }]
                      : undefined,
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Custo mercadoria
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    − {formatCurrency(sale.custo)}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.row,
                  styles.totalRow,
                  { borderColor: colors.border },
                ]}
              >
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  Total taxas + custo
                </Text>
                <Text
                  style={[
                    styles.rowValue,
                    { color: colors.error, fontWeight: '700' },
                  ]}
                >
                  − {formatCurrency(sale.totalTaxas)}
                </Text>
              </View>

              {typeof bill.refundedAmount === 'number' &&
              bill.refundedAmount > 0 ? (
                <View
                  style={[
                    styles.row,
                    styles.rowBordered,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Estorno ML
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.error }]}>
                    − {formatCurrency(bill.refundedAmount)}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.liquidoBox,
                  {
                    backgroundColor:
                      sale.liquido >= 0
                        ? colors.success + '14'
                        : colors.error + '14',
                    borderColor:
                      sale.liquido >= 0 ? colors.success : colors.error,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Text
                    style={[
                      styles.liquidoLabel,
                      {
                        color:
                          sale.liquido >= 0 ? colors.success : colors.error,
                      },
                    ]}
                  >
                    Líquido
                  </Text>
                  <Text
                    style={[
                      styles.liquidoValue,
                      {
                        color:
                          sale.liquido >= 0 ? colors.success : colors.error,
                      },
                    ]}
                  >
                    {formatCurrency(sale.liquido)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Campos condicionais (escondidos em venda — já cobertos no detalhamento) ── */}
          {!isVenda &&
          (bill.category ||
            bill.notes ||
            (typeof bill.productCost === 'number' && bill.productCost > 0) ||
            (typeof bill.refundedAmount === 'number' &&
              bill.refundedAmount > 0)) ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              {bill.category ? (
                <View style={styles.row}>
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Categoria
                  </Text>
                  <Text
                    style={[styles.rowValue, { color: colors.textPrimary }]}
                  >
                    {bill.category}
                  </Text>
                </View>
              ) : null}

              {bill.notes ? (
                <View
                  style={[
                    styles.notesRow,
                    bill.category
                      ? [styles.rowBordered, { borderColor: colors.border }]
                      : undefined,
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Observações
                  </Text>
                  <Text
                    style={[
                      styles.cardText,
                      styles.notesText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {bill.notes}
                  </Text>
                </View>
              ) : null}

              {typeof bill.productCost === 'number' && bill.productCost > 0 ? (
                <View
                  style={[
                    styles.row,
                    (bill.category || bill.notes)
                      ? [styles.rowBordered, { borderColor: colors.border }]
                      : undefined,
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Custo do produto
                  </Text>
                  <Text
                    style={[styles.rowValue, { color: colors.textPrimary }]}
                  >
                    {formatCurrency(bill.productCost)}
                  </Text>
                </View>
              ) : null}

              {typeof bill.refundedAmount === 'number' &&
              bill.refundedAmount > 0 ? (
                <View
                  style={[
                    styles.row,
                    (bill.category ||
                      bill.notes ||
                      (typeof bill.productCost === 'number' &&
                        bill.productCost > 0))
                      ? [styles.rowBordered, { borderColor: colors.border }]
                      : undefined,
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textSecondary }]}
                  >
                    Valor devolvido
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.error }]}>
                    {formatCurrency(bill.refundedAmount)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── IDs Mercado Livre ── */}
          {(bill.mlOrderId || bill.mlPackId || saleParsed?.mlListingId) ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.cardLabel, { color: colors.textSecondary }]}
              >
                Mercado Livre
              </Text>
              {bill.mlOrderId ? (
                <TouchableOpacity
                  style={styles.mlRow}
                  activeOpacity={0.6}
                  onPress={() => openMlOrder(bill.mlOrderId as string)}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={[styles.mlText, { color: colors.primary }]}>
                    Pedido: {bill.mlOrderId}
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={12}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : null}
              {bill.mlPackId ? (
                <View style={styles.mlRow}>
                  <Ionicons
                    name="cube-outline"
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.mlText, { color: colors.textMuted }]}>
                    Pack: {bill.mlPackId}
                  </Text>
                </View>
              ) : null}
              {saleParsed?.mlListingId ? (
                <TouchableOpacity
                  style={styles.mlRow}
                  activeOpacity={0.6}
                  onPress={() => openMlListing(saleParsed.mlListingId as string)}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={[styles.mlText, { color: colors.primary }]}>
                    Anúncio: {saleParsed.mlListingId}
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={12}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
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
  headerIcon: { padding: SPACING.sm, minWidth: 42, alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },

  // Hero
  hero: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroType: { fontSize: FONT_SIZE.xs, fontWeight: '500' },
  heroAmount: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  heroCaption: { fontSize: FONT_SIZE.xs, fontWeight: '500' },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // Generic card
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardLabel: { fontSize: FONT_SIZE.xs, fontWeight: '500', marginBottom: 2 },
  cardText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },

  // Row inside card
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBordered: {
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  rowLabel: { fontSize: FONT_SIZE.sm },
  rowValue: { fontSize: FONT_SIZE.sm, fontWeight: '600' },

  // Notes (text wraps)
  notesRow: { gap: SPACING.xs },
  notesText: { marginTop: 2 },

  // Card sub-elements
  cardSubtext: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },

  // Sale breakdown
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  qtyPillText: { fontSize: 11, fontWeight: '600' },
  estLabel: { fontSize: 11 },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: SPACING.md,
  },
  subRowLabel: { fontSize: FONT_SIZE.xs },
  subRowValue: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  liquidoBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm + 2,
    marginTop: SPACING.sm,
  },
  liquidoLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  liquidoValue: { fontSize: FONT_SIZE.lg, fontWeight: '700' },

  // ML IDs
  mlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  mlText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
});
