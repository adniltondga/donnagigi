import { useLocalSearchParams } from 'expo-router';
import { ProductDetailScreen } from '@/screens';

export default function ProductDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailScreen productId={id} />;
}
