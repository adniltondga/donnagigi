import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { SPACING } from '@/constants';
import { useTheme } from '@/contexts';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onPress,
  label,
  disabled = false,
}: CheckboxProps) {
  const { colors } = useTheme();

  const dynamicStyles = useMemo(
    () => ({
      checkbox: {
        borderColor: checked ? colors.primary : colors.border,
        backgroundColor: checked ? colors.primary : colors.backgroundLight,
      },
      checkmark: { color: colors.white },
      label: { color: disabled ? colors.textMuted : colors.textSecondary },
    }),
    [colors, checked, disabled],
  );

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, dynamicStyles.checkbox]}>
        {checked && (
          <Text style={[styles.checkmark, dynamicStyles.checkmark]}>✓</Text>
        )}
      </View>
      <Text style={[styles.label, dynamicStyles.label]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  checkmark: { fontSize: 14, fontWeight: 'bold' },
  label: { fontSize: 14 },
});
