import { useLocalSearchParams } from 'expo-router';
import ResetPasswordScreen from '@/screens/ResetPasswordScreen';

export default function ResetPasswordRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  return <ResetPasswordScreen email={email || ''} />;
}
