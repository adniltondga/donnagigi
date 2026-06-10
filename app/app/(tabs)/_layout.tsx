import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { colors } = useTheme();

  // No web a tab bar fica desproporcional no desktop — deixamos só no mobile.
  if (Platform.OS === 'web') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.backgroundCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'home' : 'home-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="vendas"
        options={{
          title: 'Vendas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'bag-handle' : 'bag-handle-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: 'Financeiro',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'cash' : 'cash-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'grid' : 'grid-outline') as IoniconName}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
