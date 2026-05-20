import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { mlReturnsService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { MLReturnListItem } from '@/types';

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    to_be_agreed: 'A combinar',
    pending: 'Pendente',
    shipped: 'Em trânsito',
    delivered: 'Entregue ao vendedor',
    not_delivered: 'Não entregue',
    cancelled: 'Cancelado',
  };
  return map[status] ?? status;
}

function statusColor(status: string, colors: ThemeColors): string {
  if (status === 'delivered') return colors.success;
  if (status === 'shipped') return colors.warning;
  if (status === 'cancelled' || status === 'not_delivered') return colors.error;
  return colors.textMuted;
}

function subtypeLabel(key: string): string {
  if (key === 'return_total') return 'total';
  if (key === 'return_partial') return 'parcial';
  return key;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export default function DevolucoesListScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<MLReturnListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await mlReturnsService.list();
    if (res.success) {
      setItems(res.data.data);
    } else {
      toast.error('Erro ao carregar devoluções', res.error);
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
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Devoluções
          </Text>
          {!loading && items.length > 0 ? (
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {items.length} em andamento
            </Text>
          ) : null}
        </View>
        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.returnId)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color={colors.success}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nenhuma devolução em andamento.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const accent = statusColor(item.status, colors);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/reclamacoes/[id]',
                    params: { id: String(item.claimId) },
                  } as never)
                }
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}
                >
                  <Ionicons name="cube-outline" size={20} color={accent} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    <Text
                      style={[styles.rowTitle, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      Pedido #{item.orderId}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: accent + '22',
                          borderColor: accent + '55',
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: accent }]}
                      >
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.rowMeta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    Devolução {subtypeLabel(item.subtype)} ·{' '}
                    {formatDateTime(item.dateCreated)}
                  </Text>
                  {item.trackingNumber ? (
                    <Text
                      selectable
                      style={[
                        styles.tracking,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      🚚 {item.trackingNumber}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            );
          }}
        />
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
  headerIcon: { padding: SPACING.sm, minWidth: 42 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  headerSub: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg, gap: SPACING.sm },
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
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', flexShrink: 1 },
  rowMeta: { fontSize: FONT_SIZE.xs },
  tracking: { fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
});
