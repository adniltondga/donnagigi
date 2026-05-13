import React, { useCallback, useEffect, useState } from 'react';
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
import { useTheme } from '@/contexts';
import { billsService, cashPoolService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Bill, CashPools } from '@/types';

const RECENT_LIMIT = 8;

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(last).padStart(2, '0')}`,
  };
}

export default function CashPoolsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [data, setData] = useState<CashPools | null>(null);
  const [recent, setRecent] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { start, end } = monthBounds();
    const [poolRes, billsRes] = await Promise.all([
      cashPoolService.current(),
      billsService.list({
        status: 'paid',
        paidFrom: start,
        paidTo: end,
        orderBy: 'paidDate_desc',
        limit: RECENT_LIMIT,
        excludeAportes: true,
      }),
    ]);
    if (poolRes.success) {
      setData(poolRes.data);
    } else {
      toast.error('Erro ao carregar', poolRes.error);
    }
    if (billsRes.success) {
      setRecent(billsRes.data.data);
    }
  }, []);

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

  // Reload ao voltar de /lancamentos/new ou /contas/[id]
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
          Caixas
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
        ) : data ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              SALDOS
            </Text>

            <Pool
              icon="wallet-outline"
              color={colors.primary}
              title="Reposição de estoque"
              description="Reservado pra repor o que foi vendido (CMV − bills de reposição já pagas)"
              value={data.caixaReposicao}
              colors={colors}
            />

            <Pool
              icon="lock-closed-outline"
              color={colors.info}
              title="Reserva"
              description="Saldo declarado em Configurações Financeiras"
              value={data.caixaReserva}
              colors={colors}
            />

            <Pool
              icon="trending-up-outline"
              color={
                data.lucroOperacional >= 0 ? colors.success : colors.error
              }
              title="Lucro operacional"
              description="Receita líquida − CMV − despesas (regime de caixa, mês atual)"
              value={data.lucroOperacional}
              colors={colors}
            />

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              MÊS ATUAL
            </Text>

            <View
              style={[
                styles.kpiBox,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <KpiRow
                label="Vendas líquidas"
                value={formatCurrency(data.vendasLiquidas)}
                colors={colors}
              />
              <KpiRow
                label={`CMV (${data.vendasTotais} ${data.vendasTotais === 1 ? 'venda' : 'vendas'})`}
                value={formatCurrency(data.cmv)}
                colors={colors}
              />
              <KpiRow
                label="Reposição já gasta"
                value={formatCurrency(data.gastoReposicao)}
                colors={colors}
              />
            </View>

            {data.vendasSemCusto > 0 && (
              <View
                style={[styles.warning, { borderColor: colors.warning }]}
              >
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color={colors.warning}
                />
                <Text
                  style={[styles.warningText, { color: colors.textSecondary }]}
                >
                  {data.vendasSemCusto}{' '}
                  {data.vendasSemCusto === 1 ? 'venda' : 'vendas'} sem custo
                  cadastrado — caixa de reposição subestimada.
                </Text>
              </View>
            )}

            <View style={styles.recentHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                LANÇAMENTOS RECENTES
              </Text>
              {recent.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/contas' as never)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.seeAll, { color: colors.primary }]}>
                    Ver todos
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {recent.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Nenhum lançamento pago neste mês.
              </Text>
            ) : (
              <View
                style={[
                  styles.recentBox,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                {recent.map((b, idx) => (
                  <RecentRow
                    key={b.id}
                    bill={b}
                    isLast={idx === recent.length - 1}
                    onPress={() =>
                      router.push({
                        pathname: '/contas/[id]',
                        params: { id: b.id },
                      } as never)
                    }
                    colors={colors}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Não foi possível carregar.
          </Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.success,
              },
            ]}
            onPress={() =>
              router.push('/lancamentos/new?type=receivable' as never)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-down-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>Entrada</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            onPress={() =>
              router.push('/lancamentos/new?type=payable' as never)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>Saída</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function Pool({
  icon,
  color,
  title,
  description,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  title: string;
  description: string;
  value: number;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.pool,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.poolIcon, { backgroundColor: colors.backgroundLight }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.poolBody}>
        <Text style={[styles.poolTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text
          style={[styles.poolDesc, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
      <Text
        style={[styles.poolValue, { color: value < 0 ? colors.error : colors.textPrimary }]}
      >
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function RecentRow({
  bill,
  isLast,
  onPress,
  colors,
}: {
  bill: Bill;
  isLast: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const isIncome = bill.type === 'receivable';
  const sign = isIncome ? '+' : '−';
  const tone = isIncome ? colors.success : colors.error;
  const icon: React.ComponentProps<typeof Ionicons>['name'] = isIncome
    ? 'arrow-down-outline'
    : 'arrow-up-outline';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.recentRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.recentIcon,
          { backgroundColor: tone + '1F' },
        ]}
      >
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <View style={styles.recentBody}>
        <Text
          style={[styles.recentDesc, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {bill.description}
        </Text>
        <Text style={[styles.recentDate, { color: colors.textMuted }]}>
          {formatDate(bill.paidDate ?? bill.dueDate)}
        </Text>
      </View>
      <Text style={[styles.recentAmount, { color: tone }]}>
        {sign} {formatCurrency(bill.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function KpiRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.kpiRow}>
      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  pool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  poolIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  poolBody: { flex: 1, gap: 2 },
  poolTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  poolDesc: { fontSize: 11, lineHeight: 14 },
  poolValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  kpiBox: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: { fontSize: FONT_SIZE.sm },
  kpiValue: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  warningText: { fontSize: FONT_SIZE.xs, flex: 1, lineHeight: 18 },
  empty: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  seeAll: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  recentBox: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentBody: { flex: 1, gap: 2 },
  recentDesc: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  recentDate: { fontSize: FONT_SIZE.xs },
  recentAmount: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '700' },
});
