import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAuth, useTheme } from '@/contexts';
import { notificationService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface MaisItem {
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  label: string;
  href?: Href;
  onPress?: () => void;
  badge?: number;
  destructive?: boolean;
}

interface MaisSection {
  title: string;
  items: MaisItem[];
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  item,
  isLast,
  colors,
  onPress,
}: {
  item: MaisItem;
  isLast: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const labelColor = item.destructive ? colors.error : colors.textPrimary;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={[
        rowStyles.row,
        { borderBottomColor: colors.border },
        !isLast && rowStyles.divider,
      ]}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <Text style={[rowStyles.label, { color: labelColor }]}>{item.label}</Text>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <View style={[rowStyles.badge, { backgroundColor: colors.error }]}>
          <Text style={rowStyles.badgeText}>
            {item.badge > 9 ? '9+' : item.badge}
          </Text>
        </View>
      )}
      {!item.destructive && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md - 2,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '500' },
  badge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MaisScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    const res = await notificationService.list();
    if (res.success) setUnreadCount(res.data.unreadCount);
  }, []);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
    }, [loadUnread]),
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          toast.success('Até logo!');
          router.replace('/');
        },
      },
    ]);
  }, [logout, router]);

  const sections: MaisSection[] = [
    {
      title: 'OPERAÇÃO',
      items: [
        {
          icon: 'cube-outline',
          iconBg: colors.primary + '1F',
          iconColor: colors.primary,
          label: 'Produtos',
          href: '/produtos' as Href,
        },
        {
          icon: 'scan-outline',
          iconBg: colors.info + '1F',
          iconColor: colors.info,
          label: 'Scanner de código',
          href: '/produtos/scanner' as Href,
        },
        {
          icon: 'pricetag-outline',
          iconBg: colors.warning + '1F',
          iconColor: colors.warning,
          label: 'Anúncios Mercado Livre',
          href: '/anuncios' as Href,
        },
      ],
    },
    {
      title: 'CONTA',
      items: [
        {
          icon: 'notifications-outline',
          iconBg: colors.error + '1F',
          iconColor: colors.error,
          label: 'Notificações',
          href: '/notifications' as Href,
          badge: unreadCount,
        },
        {
          icon: 'settings-outline',
          iconBg: colors.textMuted + '2F',
          iconColor: colors.textPrimary,
          label: 'Configurações',
          href: '/settings' as Href,
        },
      ],
    },
    {
      title: '',
      items: [
        {
          icon: 'log-out-outline',
          iconBg: colors.error + '1F',
          iconColor: colors.error,
          label: 'Sair da conta',
          destructive: true,
          onPress: handleLogout,
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Mais
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User card */}
        <View
          style={[
            styles.userCard,
            {
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text
              style={[styles.userName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {user?.name || user?.username || 'Usuário'}
            </Text>
            {user?.email && (
              <Text
                style={[styles.userEmail, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {user.email}
              </Text>
            )}
          </View>
        </View>

        {/* Sections */}
        {sections.map((section, idx) => (
          <View key={`${section.title}-${idx}`} style={styles.section}>
            {section.title ? (
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                {section.title}
              </Text>
            ) : null}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              {section.items.map((item, i) => (
                <Row
                  key={item.label}
                  item={item}
                  isLast={i === section.items.length - 1}
                  colors={colors}
                  onPress={() => {
                    if (item.onPress) item.onPress();
                    else if (item.href) router.push(item.href);
                  }}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  userEmail: { fontSize: FONT_SIZE.xs, marginTop: 2 },

  // Section
  section: { gap: SPACING.xs },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.sm,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
