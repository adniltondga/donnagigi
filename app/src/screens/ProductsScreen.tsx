import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { productsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Product } from '@/types';

export default function ProductsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (text: string, manual = false) => {
    setLoading(true);
    const res = text.trim()
      ? await productsService.search(text.trim())
      : await productsService.list();
    setLoading(false);
    if (res.success) {
      setItems(res.data.data);
      if (manual && text.trim() && res.data.data.length === 0) {
        toast.info('Nenhum produto encontrado', text);
      }
    } else {
      toast.error('Erro', res.error);
    }
  }, []);

  // Carga inicial (lista geral)
  useEffect(() => {
    void runSearch('');
  }, [runSearch]);

  // Debounce na busca por texto digitado
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Barcode vindo do scanner via deep param — preenche e busca imediato
  useFocusEffect(
    useCallback(() => {
      if (barcode && typeof barcode === 'string') {
        setQuery(barcode);
        void runSearch(barcode, true);
        // Limpa o param pra não re-disparar se voltar pra cá
        router.setParams({ barcode: '' });
      }
    }, [barcode, runSearch, router]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSearch(query);
    setRefreshing(false);
  }, [query, runSearch]);

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
          Produtos
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome ou código"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query !== '' && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/produtos/scanner' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="barcode-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loading}
        />
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {query
                  ? 'Nenhum produto encontrado'
                  : 'Nenhum produto cadastrado'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              colors={colors}
              onPress={() =>
                router.push({
                  pathname: '/produtos/[id]',
                  params: { id: item.id },
                } as never)
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function ProductRow({
  product,
  colors,
  onPress,
}: {
  product: Product;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const firstVariant = product.variants[0];
  const image = firstVariant?.images?.[0]?.url;
  const price = firstVariant?.salePrice ?? product.baseSalePrice ?? 0;
  const stock = product.variants.reduce((s, v) => s + v.stock, 0);
  const lowStock = product.minStock != null && stock <= product.minStock;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View
        style={[styles.imageWrap, { backgroundColor: colors.backgroundLight }]}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowPrice, { color: colors.primary }]}>
            {formatCurrency(price)}
          </Text>
          <Text
            style={[
              styles.rowStock,
              { color: lowStock ? colors.error : colors.textSecondary },
            ]}
          >
            {stock} em estoque
          </Text>
        </View>
        {firstVariant?.cod && (
          <Text style={[styles.rowCode, { color: colors.textMuted }]}>
            {firstVariant.cod}
          </Text>
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
  searchRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    paddingVertical: 0,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loading: { marginTop: SPACING.xxl },
  list: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.sm },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT_SIZE.sm },
  row: {
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
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 18 },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  rowPrice: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  rowStock: { fontSize: FONT_SIZE.xs },
  rowCode: { fontSize: FONT_SIZE.xs, fontFamily: 'monospace' },
});
