import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { productsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Product, ProductVariant } from '@/types';

interface Props {
  productId: string;
}

export default function ProductDetailScreen({ productId }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await productsService.detail(productId);
    if (res.success) {
      setProduct(res.data);
    } else {
      toast.error('Erro', res.error);
      router.back();
    }
  }, [productId, router]);

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

  const totalStock = product
    ? product.variants.reduce((s, v) => s + v.stock, 0)
    : 0;
  const lowStock =
    product?.minStock != null && totalStock <= product.minStock;

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
          Detalhe do produto
        </Text>
        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !product ? null : (
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {product.name}
          </Text>
          {product.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {product.description}
            </Text>
          ) : null}

          <View
            style={[
              styles.kpiRow,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.kpi}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                Estoque total
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  { color: lowStock ? colors.error : colors.textPrimary },
                ]}
              >
                {totalStock}
              </Text>
              {lowStock ? (
                <Text style={[styles.kpiHint, { color: colors.error }]}>
                  abaixo do mínimo ({product.minStock})
                </Text>
              ) : null}
            </View>
            <View
              style={[styles.kpiDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.kpi}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                Preço base
              </Text>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {product.baseSalePrice != null
                  ? formatCurrency(product.baseSalePrice)
                  : '—'}
              </Text>
            </View>
            <View
              style={[styles.kpiDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.kpi}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                Custo
              </Text>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {product.productCost != null
                  ? formatCurrency(product.productCost)
                  : '—'}
              </Text>
            </View>
          </View>

          {product.mlListingId ? (
            <View
              style={[
                styles.mlBadge,
                {
                  borderColor: colors.warning,
                  backgroundColor: colors.warning + '12',
                },
              ]}
            >
              <Ionicons
                name="megaphone-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={[styles.mlText, { color: colors.warning }]}>
                Anúncio ML: {product.mlListingId}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Variantes ({product.variants.length})
          </Text>

          {product.variants.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Este produto não tem variantes ativas.
            </Text>
          ) : (
            product.variants.map((v) => (
              <VariantCard
                key={v.id}
                variant={v}
                fallbackPrice={product.baseSalePrice}
                colors={colors}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function VariantCard({
  variant,
  fallbackPrice,
  colors,
}: {
  variant: ProductVariant;
  fallbackPrice: number | null | undefined;
  colors: ThemeColors;
}) {
  const image = variant.images?.[0]?.url;
  const price = variant.salePrice ?? fallbackPrice ?? null;
  return (
    <View
      style={[
        styles.variant,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[styles.imageWrap, { backgroundColor: colors.backgroundLight }]}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Ionicons name="cube-outline" size={26} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.variantBody}>
        <Text
          style={[styles.variantTitle, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {variant.title || 'Sem nome'}
        </Text>
        <View style={styles.variantMeta}>
          <Text style={[styles.variantPrice, { color: colors.primary }]}>
            {price != null ? formatCurrency(price) : '—'}
          </Text>
          <Text style={[styles.variantStock, { color: colors.textSecondary }]}>
            {variant.stock} em estoque
          </Text>
        </View>
        {variant.cod ? (
          <Text style={[styles.variantCode, { color: colors.textMuted }]}>
            COD: {variant.cod}
          </Text>
        ) : null}
        {variant.mlListingId ? (
          <Text style={[styles.variantMl, { color: colors.warning }]}>
            ML: {variant.mlListingId}
          </Text>
        ) : null}
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  description: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  kpiRow: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    alignItems: 'stretch',
  },
  kpi: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xs, gap: 2 },
  kpiDivider: { width: 1 },
  kpiLabel: { fontSize: FONT_SIZE.xs },
  kpiValue: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  kpiHint: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  mlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  mlText: { fontSize: FONT_SIZE.xs, fontWeight: '600', flex: 1 },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  empty: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  variant: {
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
  variantBody: { flex: 1, gap: 2 },
  variantTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 18 },
  variantMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  variantPrice: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  variantStock: { fontSize: FONT_SIZE.xs },
  variantCode: { fontSize: FONT_SIZE.xs, fontFamily: 'monospace' },
  variantMl: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
});
