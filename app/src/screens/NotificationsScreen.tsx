import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import { notificationService, pushService } from '@/services';
import { toast } from '@/utils/toast';
import { backendLinkToAppRoute } from '@/utils/deeplink';
import type { AppNotification } from '@/types';

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('pt-BR');
}

function iconForType(type: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'sale':
      return 'cart-outline';
    case 'refund':
      return 'arrow-undo-outline';
    case 'mp_release':
      return 'cash-outline';
    case 'system':
      return 'settings-outline';
    default:
      return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await notificationService.list();
    if (res.success) {
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
      void pushService.clearBadge();
    } else {
      toast.error('Erro ao carregar', res.error);
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

  const handleItemPress = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void notificationService.markRead(n.id);
    }
    const route = backendLinkToAppRoute(n.link);
    if (route) {
      router.push(route);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    const res = await notificationService.markAllRead();
    if (!res.success) toast.error('Erro', res.error);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Notificações
        </Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={unreadCount === 0}
        >
          <Text
            style={[
              styles.markAll,
              {
                color: unreadCount > 0 ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Marcar todas
          </Text>
        </TouchableOpacity>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Sem notificações
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
              style={[
                styles.row,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                  opacity: item.read ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons
                  name={iconForType(item.type)}
                  size={20}
                  color={colors.primary}
                />
                {!item.read && (
                  <View
                    style={[styles.dot, { backgroundColor: colors.primary }]}
                  />
                )}
              </View>
              <View style={styles.body}>
                <Text
                  style={[styles.title, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.body && (
                  <Text
                    style={[styles.bodyText, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                )}
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerIcon: { padding: SPACING.sm },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  markAll: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm },
  row: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  bodyText: { fontSize: FONT_SIZE.xs, lineHeight: 18 },
  time: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT_SIZE.sm },
});
