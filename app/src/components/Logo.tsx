import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts';
import { SPACING } from '@/constants';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Esconde o texto ao lado/abaixo e mostra só o ícone. */
  iconOnly?: boolean;
  /** Empilha o texto abaixo do ícone (default: lado a lado). */
  orientation?: 'row' | 'column';
  /** Texto exibido junto ao ícone. Default: "AgLivre". */
  label?: string;
}

const iconPng = require('../../assets/icon.png');

export function Logo({
  size = 'md',
  iconOnly = false,
  orientation = 'row',
  label = 'AgLivre',
}: LogoProps) {
  const { colors } = useTheme();
  const iconSize = size === 'lg' ? 80 : size === 'sm' ? 32 : 48;
  const fontSize = size === 'lg' ? 32 : size === 'sm' ? 18 : 24;
  const radius = Math.round(iconSize * 0.22); // squircle-like, padrão iOS

  return (
    <View
      style={[
        styles.container,
        orientation === 'column' ? styles.column : styles.row,
      ]}
    >
      <Image
        source={iconPng}
        style={{ width: iconSize, height: iconSize, borderRadius: radius }}
        resizeMode="cover"
      />
      {!iconOnly && (
        <Text style={[styles.text, { color: colors.textPrimary, fontSize }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
