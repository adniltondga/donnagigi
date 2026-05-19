import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { mlClaimsService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { MLClaimListItem } from '@/types';

const PAGE_SIZE = 50;

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

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    claim: 'Reclamação',
    dispute: 'Em disputa',
    return: 'Devolução',
    cancel: 'Cancelamento',
  };
  return map[stage] ?? stage;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    mediations: 'Mediação',
    claims: 'Reclamação',
    cancel_purchase: 'Cancelamento',
    return: 'Devolução',
  };
  return map[type] ?? type;
}

export default function ReclamacoesListScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<MLClaimListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await mlClaimsService.list({
      status: 'opened',
      limit: PAGE_SIZE,
      enrich: true,
    });
    if (res.success) {
      setItems(res.data.data);
      setTotal(res.data.paging.total);
    } else {
      toast.error('Erro ao carregar reclamações', res.error);
    }
  }, []);

  // "Aguardando você" no topo; depois ordena por última atividade desc.
  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const aNeed = a.needsResponse ? 0 : 1;
      const bNeed = b.needsResponse ? 0 : 1;
      if (aNeed !== bNeed) return aNeed - bNeed;
      const aT = a.lastMessageAt || a.lastUpdated;
      const bT = b.lastMessageAt || b.lastUpdated;
      return bT.localeCompare(aT);
    });
    return copy;
  }, [items]);

  const pending = useMemo(
    () => items.filter((i) => i.needsResponse).length,
    [items],
  );
  const answered = items.length - pending;

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
            Reclamações
          </Text>
          {!loading && total > 0 ? (
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              <Text style={{ color: colors.error, fontWeight: '700' }}>
                {pending} aguardando você
              </Text>
              {answered > 0 ? ` · ${answered} já respondida${
                answered === 1 ? '' : 's'
              }` : ''}
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
          data={sorted}
          keyExtractor={(item) => String(item.id)}
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
                Nenhuma reclamação em aberto.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            // needsResponse pode vir undefined em listagens sem enrich;
            // nesses casos preferimos não suposicionar — tratamos como
            // "já respondida" pra não gerar falso alarme.
            const needs = item.needsResponse === true;
            const accent = needs ? colors.error : colors.textMuted;
            const lastWhen = item.lastMessageAt || item.lastUpdated;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/reclamacoes/[id]',
                    params: { id: String(item.id) },
                  } as never)
                }
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: needs ? colors.error + '55' : colors.border,
                  },
                ]}
              >
                <View
                  style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}
                >
                  <Ionicons
                    name={
                      needs ? 'alert-circle-outline' : 'checkmark-done-outline'
                    }
                    size={20}
                    color={accent}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    <Text
                      style={[styles.rowTitle, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {typeLabel(item.type)} #{item.id}
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
                        {needs ? 'Aguardando você' : 'Já respondida'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {stageLabel(item.stage)} · {formatDateTime(lastWhen)}
                  </Text>
                  {item.reasonId ? (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      Motivo: {item.reasonId}
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
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
});
