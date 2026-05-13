import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';
import { SPACING } from '@/constants';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const { colors } = useTheme();
  const iconSize = size === 'lg' ? 48 : size === 'sm' ? 24 : 36;
  const fontSize = size === 'lg' ? 32 : size === 'sm' ? 18 : 24;

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: colors.primary }]}>
        <Ionicons name="leaf" size={iconSize} color={colors.white} />
      </View>
      <Text style={[styles.text, { color: colors.textPrimary, fontSize }]}>
        AgLivre
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconWrapper: {
    padding: SPACING.sm,
    borderRadius: 12,
  },
  text: {
    fontWeight: '700',
  },
});
