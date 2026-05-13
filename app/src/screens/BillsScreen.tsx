import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { billsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS, COLORS } from '@/constants';
import type { Bill, BillStatus, BillType } from '@/types';

const PAGE_SIZE = 20;
type StatusFilter = 'pending' | 'paid';

function isOverdue(b: Bill): boolean {
  if (b.status !== 'pending') return false;
  const due = new Date(b.dueDate);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export default function BillsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [tab, setTab] = useState<BillType>('payable');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [items, setItems] = useState<Bill[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (
      targetPage: number,
      type: BillType,
      status: BillStatus,
      reset = false,
    ): Promise<void> => {
      const res = await billsService.list({
        type,
        status,
        page: targetPage,
        limit: PAGE_SIZE,
        orderBy: status === 'pending' ? 'dueDate_asc' : 'paidDate_desc',
        excludeAportes: true,
      });
      if (!res.success) {
        toast.error('Erro ao carregar', res.error);
        return;
      }
      const nextItems = res.data.data;
      const totalPages = res.data.pages ?? 1;
      setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setPage(targetPage);
      setHasMore(targetPage < totalPages);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setItems([]);
      await fetchPage(1, tab, statusFilter, true);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, statusFilter, fetchPage]);

  // Atualiza ao voltar do detalhe ou do novo lançamento
  useFocusEffect(
    useCallback(() => {
      void fetchPage(1, tab, statusFilter, true);
    }, [tab, statusFilter, fetchPage]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1, tab, statusFilter, true);
    setRefreshing(false);
  }, [tab, statusFilter, fetchPage]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    await fetchPage(page + 1, tab, statusFilter);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, page, tab, statusFilter, fetchPage]);

  const handleMarkPaid = useCallback(
    (bill: Bill) => {
      const verb = tab === 'payable' ? 'pagar' : 'receber';
      Alert.alert(
        `Marcar como ${verb === 'pagar' ? 'paga' : 'recebida'}?`,
        `${bill.description}\n${formatCurrency(bill.amount)}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: async () => {
              setItems((prev) => prev.filter((i) => i.id !== bill.id));
              const res = await billsService.markPaid(bill.id);
              if (res.success) {
                toast.success(
                  tab === 'payable' ? 'Conta paga!' : 'Recebimento registrado!',
                );
              } else {
                toast.error('Erro', res.error);
                void onRefresh();
              }
            },
          },
        ],
      );
    },
    [tab, onRefresh],
  );

  const totals = useMemo(
    () => items.reduce((sum, b) => sum + b.amount, 0),
    [items],
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Contas
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <View
        style={[
          styles.tabs,
          { backgroundColor: colors.backgroundCard, borderColor: colors.border },
        ]}
      >
        <Tab
          label="A pagar"
          active={tab === 'payable'}
          onPress={() => setTab('payable')}
          colors={colors}
        />
        <Tab
          label="A receber"
          active={tab === 'receivable'}
          onPress={() => setTab('receivable')}
          colors={colors}
        />
      </View>

      <View
        style={[
          styles.statusTabs,
          { backgroundColor: colors.backgroundCard, borderColor: colors.border },
        ]}
      >
        <Tab
          label="Pendentes"
          active={statusFilter === 'pending'}
          onPress={() => setStatusFilter('pending')}
          colors={colors}
        />
        <Tab
          label="Pagas"
          active={statusFilter === 'paid'}
          onPress={() => setStatusFilter('paid')}
          colors={colors}
        />
      </View>

      <View style={styles.totalBar}>
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
          {items.length}{' '}
          {statusFilter === 'pending'
            ? `pendente${items.length === 1 ? '' : 's'}`
            : `paga${items.length === 1 ? '' : 's'}`}
        </Text>
        <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
          {formatCurrency(totals)}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: SPACING.md }}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-done-circle-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nenhuma conta {tab === 'payable' ? 'a pagar' : 'a receber'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <BillCard
              bill={item}
              tab={tab}
              statusFilter={statusFilter}
              onPress={() =>
                router.push({
                  pathname: '/contas/[id]',
                  params: { id: item.id },
                } as never)
              }
              onMarkPaid={() => handleMarkPaid(item)}
              colors={colors}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: '/lancamentos/new',
            params: { type: tab },
          } as never)
        }
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function Tab({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        active && { backgroundColor: colors.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tabText,
          {
            color: active ? '#fff' : colors.textSecondary,
            fontWeight: active ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function BillCard({
  bill,
  tab,
  statusFilter,
  onPress,
  onMarkPaid,
  colors,
}: {
  bill: Bill;
  tab: BillType;
  statusFilter: StatusFilter;
  onPress: () => void;
  onMarkPaid: () => void;
  colors: ThemeColors;
}) {
  const isPaid = statusFilter === 'paid';
  const overdue = !isPaid && isOverdue(bill);
  const accent = isPaid
    ? colors.success
    : overdue
      ? colors.error
      : tab === 'payable'
        ? colors.warning
        : colors.success;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text
            style={[styles.cardDesc, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {bill.description}
          </Text>
          <Text style={[styles.cardAmount, { color: colors.textPrimary }]}>
            {formatCurrency(bill.amount)}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons
            name={isPaid ? 'checkmark-done-outline' : 'calendar-outline'}
            size={14}
            color={colors.textMuted}
          />
          <Text style={[styles.cardDate, { color: colors.textMuted }]}>
            {isPaid
              ? `Paga em ${formatDate(bill.paidDate ?? bill.dueDate)}`
              : `${overdue ? 'Venceu em ' : 'Vence em '}${formatDate(bill.dueDate)}`}
          </Text>
          {overdue && (
            <View style={[styles.overdueBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.overdueText}>Vencida</Text>
            </View>
          )}
        </View>

        {!isPaid && (
          <TouchableOpacity
            style={[styles.payBtn, { borderColor: accent }]}
            onPress={onMarkPaid}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={accent} />
            <Text style={[styles.payBtnText, { color: accent }]}>
              {tab === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'}
            </Text>
          </TouchableOpacity>
        )}
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
  tabs: {
    flexDirection: 'row',
    margin: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 4,
  },
  statusTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  tabText: { fontSize: FONT_SIZE.sm },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  totalLabel: { fontSize: FONT_SIZE.xs },
  totalValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.sm },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT_SIZE.sm },
  card: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.md, gap: SPACING.sm },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  cardDesc: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  cardAmount: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardDate: { fontSize: FONT_SIZE.xs },
  overdueBadge: {
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  payBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
