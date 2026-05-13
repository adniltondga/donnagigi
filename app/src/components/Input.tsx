import React, { useState, memo, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import { useTheme } from '@/contexts';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export const Input = memo(function Input({
  label,
  error,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const dynamicStyles = useMemo(
    () => ({
      label: { color: colors.textSecondary },
      inputContainer: {
        backgroundColor: colors.backgroundCard,
        borderColor: isFocused
          ? colors.primary
          : error
            ? colors.error
            : colors.border,
      },
      input: { color: colors.textPrimary },
      errorText: { color: colors.error },
    }),
    [colors, isFocused, error],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, dynamicStyles.label]}>{label}</Text>
      <View style={[styles.inputContainer, dynamicStyles.inputContainer]}>
        <TextInput
          style={[styles.input, dynamicStyles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.md },
  label: {
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
  },
  iconButton: { padding: SPACING.md },
  errorText: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
