import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth, useTheme } from '@/contexts';
import { LoginScreen } from '@/screens';

export default function Index() {
  const { isAuthenticated, isInitializing } = useAuth();
  const { colors } = useTheme();

  if (isInitializing) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return <LoginScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
