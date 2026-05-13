import React, { memo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button = memo(function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.button,
        styles[variant],
        isDisabled && styles.disabled,
        style,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={() =>
        (scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }))
      }
      onPressOut={() =>
        (scale.value = withSpring(1, { damping: 15, stiffness: 300 }))
      }
      disabled={isDisabled}
      activeOpacity={1}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? COLORS.primary : COLORS.white}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'outline' && styles.outlineText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedTouchable>
  );
});

const styles = StyleSheet.create({
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.primaryDark },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  disabled: { opacity: 0.6 },
  text: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  outlineText: { color: COLORS.primary },
});
