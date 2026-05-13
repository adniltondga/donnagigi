import { useLocalSearchParams } from 'expo-router';
import VerifyEmailScreen from '@/screens/VerifyEmailScreen';

export default function VerifyEmailRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  return <VerifyEmailScreen email={email || ''} />;
}
