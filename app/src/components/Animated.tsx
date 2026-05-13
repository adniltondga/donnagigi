import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface AnimatedViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export function FadeInView({
  children,
  delay = 0,
  duration = 400,
  style,
}: AnimatedViewProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.ease }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export function SlideUpView({
  children,
  delay = 0,
  duration = 500,
  style,
}: AnimatedViewProps) {
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 15, stiffness: 100 }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: duration * 0.6 }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
