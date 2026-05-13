import { useLocalSearchParams } from 'expo-router';
import { QuickEntryScreen } from '@/screens';
import type { BillType } from '@/types';

export default function LancamentoNewRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const initial: BillType =
    type === 'receivable' ? 'receivable' : 'payable';
  return <QuickEntryScreen initialType={initial} />;
}
