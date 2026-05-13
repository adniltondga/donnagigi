import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';
import { SPACING, COLORS } from '@/constants';

type IconName = keyof typeof Ionicons.glyphMap;

interface CardProps {
  icon: IconName;
  title: string;
  description?: string;
  onPress?: () => void;
  badge?: string | number;
  badgeColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function Card({
  icon,
  title,
  description,
  onPress,
  badge,
  badgeColor,
  style,
  disabled = false,
}: CardProps) {
  const { colors } = useTheme();

  const dynamicStyles = useMemo(
    () => ({
      container: {
        backgroundColor: colors.backgroundCard,
        borderColor: colors.border,
      } as ViewStyle,
      title: { color: colors.textPrimary } as TextStyle,
      description: { color: colors.textSecondary } as TextStyle,
      badge: { backgroundColor: badgeColor || colors.primary } as ViewStyle,
    }),
    [colors, badgeColor],
  );

  const content = (
    <>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={32} color={colors.primary} />
        {badge !== undefined && (
          <View style={[styles.badge, dynamicStyles.badge]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
        {description && (
          <Text
            style={[styles.description, dynamicStyles.description]}
            numberOfLines={2}
          >
            {description}
          </Text>
        )}
      </View>

      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={24}
          color={colors.textSecondary}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          dynamicStyles.container,
          style,
          disabled && styles.disabled,
        ]}
        onPress={disabled ? undefined : onPress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: { position: 'relative', marginRight: SPACING.md },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 13, lineHeight: 18 },
  disabled: { opacity: 0.5 },
});
