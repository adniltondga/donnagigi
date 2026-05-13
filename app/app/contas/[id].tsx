import { useLocalSearchParams } from 'expo-router';
import { BillDetailScreen } from '@/screens';

export default function ContaDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BillDetailScreen billId={id} />;
}
