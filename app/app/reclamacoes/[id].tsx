import { useLocalSearchParams } from 'expo-router';
import { ReclamacaoDetailScreen } from '@/screens';

export default function ReclamacaoDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReclamacaoDetailScreen claimId={id} />;
}
