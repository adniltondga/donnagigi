import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';
import { SPACING, FONT_SIZE, BORDER_RADIUS, COLORS } from '@/constants';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = memo(function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const accent = variant === 'destructive' ? COLORS.error : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View
          entering={ZoomIn.duration(180)}
          exiting={ZoomOut.duration(120)}
          style={[
            styles.card,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
            <Ionicons
              name={
                variant === 'destructive' ? 'trash-outline' : 'alert-circle-outline'
              }
              size={24}
              color={accent}
            />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {description}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                styles.cancel,
                { borderColor: colors.border },
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.confirm,
                { backgroundColor: accent },
                loading && styles.disabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.xs },
  description: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: 100,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { borderWidth: 1, backgroundColor: 'transparent' },
  cancelText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  confirm: {},
  confirmText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  disabled: { opacity: 0.7 },
});
