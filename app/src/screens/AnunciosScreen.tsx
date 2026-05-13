import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { mlAdsService, productsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Product, ProductVariant } from '@/types';

/**
 * Lista de produtos vinculados ao Mercado Livre (com mlListingId). Cada
 * linha tem um toggle pra pausar/ativar o anúncio. O status atual do
 * ML não é armazenado localmente — quando o user toca o toggle, o back
 * lê o status no ML e inverte, e a UI assume otimisticamente.
 */

interface AdRow {
  productId: string;
  productName: string;
  variantId: string | null;
  mlListingId: string;
  price: number;
  stock: number;
  image: string | null;
}

function adsFromProducts(products: Product[]): AdRow[] {
  const rows: AdRow[] = [];
  products.forEach((p) => {
    if (p.mlListingId) {
      const firstVariant: ProductVariant | undefined = p.variants[0];
      rows.push({
        productId: p.id,
        productName: p.name,
        variantId: null,
        mlListingId: p.mlListingId,
        price: p.baseSalePrice ?? firstVariant?.salePrice ?? 0,
        stock: p.variants.reduce((s, v) => s + v.stock, 0),
        image: firstVariant?.images?.[0]?.url ?? null,
      });
    }
    p.variants.forEach((v) => {
      if (v.mlListingId) {
        rows.push({
          productId: p.id,
          productName: `${p.name}${v.title ? ` — ${v.title}` : ''}`,
          variantId: v.id,
          mlListingId: v.mlListingId,
          price: v.salePrice ?? 0,
          stock: v.stock,
          image: v.images?.[0]?.url ?? null,
        });
      }
    });
  });
  return rows;
}

export default function AnunciosScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // mlListingId -> 'active' | 'paused' (estado conhecido após toggle)
  const [statusMap, setStatusMap] = useState<Record<string, 'active' | 'paused'>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await productsService.list(1, 100);
    if (res.success) {
      setProducts(res.data.data);
    } else {
      toast.error('Erro', res.error);
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

  const rows = useMemo(() => adsFromProducts(products), [products]);

  const handleToggle = useCallback(
    (row: AdRow) => {
      const current = statusMap[row.mlListingId];
      const verb =
        current === 'active'
          ? 'Pausar'
          : current === 'paused'
            ? 'Ativar'
            : 'Alternar';
      Alert.alert(
        `${verb} anúncio?`,
        `${row.productName}\n${row.mlListingId}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: async () => {
              setToggling((prev) => ({ ...prev, [row.mlListingId]: true }));
              const res = await mlAdsService.toggleItem(row.mlListingId);
              setToggling((prev) => ({ ...prev, [row.mlListingId]: false }));
              if (res.success) {
                setStatusMap((prev) => ({
                  ...prev,
                  [row.mlListingId]: res.data.status,
                }));
                toast.success(
                  res.data.status === 'active'
                    ? 'Anúncio ativado'
                    : 'Anúncio pausado',
                );
              } else {
                toast.error('Erro', res.error);
              }
            },
          },
        ],
      );
    },
    [statusMap],
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
          Anúncios ML
        </Text>
        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loading}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.mlListingId}
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
                name="megaphone-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nenhum anúncio vinculado ao ML
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AdCard
              row={item}
              status={statusMap[item.mlListingId]}
              toggling={!!toggling[item.mlListingId]}
              onToggle={() => handleToggle(item)}
              colors={colors}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function AdCard({
  row,
  status,
  toggling,
  onToggle,
  colors,
}: {
  row: AdRow;
  status: 'active' | 'paused' | undefined;
  toggling: boolean;
  onToggle: () => void;
  colors: ThemeColors;
}) {
  const statusColor =
    status === 'active'
      ? colors.success
      : status === 'paused'
        ? colors.warning
        : colors.textMuted;
  const statusLabel =
    status === 'active' ? 'Ativo' : status === 'paused' ? 'Pausado' : '—';

  const action =
    status === 'active' ? 'Pausar' : status === 'paused' ? 'Ativar' : 'Alternar';
  const actionIcon: React.ComponentProps<typeof Ionicons>['name'] =
    status === 'active' ? 'pause-circle-outline' : 'play-circle-outline';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[styles.imageWrap, { backgroundColor: colors.backgroundLight }]}
      >
        {row.image ? (
          <Image source={{ uri: row.image }} style={styles.image} />
        ) : (
          <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {row.productName}
        </Text>
        <View style={styles.cardRow}>
          <Text style={[styles.cardPrice, { color: colors.primary }]}>
            {formatCurrency(row.price)}
          </Text>
          <Text style={[styles.cardStock, { color: colors.textSecondary }]}>
            {row.stock} em estoque
          </Text>
        </View>
        <Text style={[styles.cardId, { color: colors.textMuted }]}>
          {row.mlListingId}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.statusWrap}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, { borderColor: colors.primary }]}
            onPress={onToggle}
            disabled={toggling}
            activeOpacity={0.7}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={actionIcon}
                  size={16}
                  color={colors.primary}
                />
                <Text
                  style={[styles.toggleText, { color: colors.primary }]}
                >
                  {action}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  loading: { marginTop: SPACING.xxl },
  list: { padding: SPACING.lg, gap: SPACING.sm },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT_SIZE.sm },
  card: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  imageWrap: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: { width: 56, height: 56 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 18 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  cardStock: { fontSize: FONT_SIZE.xs },
  cardId: { fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    minWidth: 90,
    justifyContent: 'center',
  },
  toggleText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
});
