import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { Input, Button } from '@/components';
import { billsService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { BillType } from '@/types';

interface Props {
  initialType?: BillType;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function maskDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brDateToISO(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const mi = parseInt(mo, 10);
  const di = parseInt(d, 10);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  return `${y}-${mo}-${d}`;
}

function maskMoneyBR(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const reais = padded.slice(0, -2).replace(/^0+(?!$)/, '');
  const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reaisFmt},${cents}`;
}

function moneyToNumber(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function todayBR(): string {
  const iso = todayISO();
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function QuickEntryScreen({ initialType = 'payable' }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [type, setType] = useState<BillType>(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayBR());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    const value = moneyToNumber(amount);
    if (value <= 0) next.amount = 'Informe um valor';
    if (!description.trim() || description.trim().length < 2)
      next.description = 'Descrição muito curta';
    const iso = brDateToISO(date);
    if (!iso) next.date = 'Data inválida (DD/MM/AAAA)';
    setErrors(next);
    return Object.keys(next).length === 0 ? { value, iso: iso! } : null;
  }, [amount, description, date]);

  const handleSubmit = useCallback(async () => {
    const ok = validate();
    if (!ok) return;
    setSubmitting(true);
    const res = await billsService.create({
      type,
      amount: ok.value,
      description: description.trim(),
      dueDate: ok.iso,
      category: type === 'receivable' ? 'outro' : 'outro',
    });
    setSubmitting(false);
    if (res.success) {
      toast.success(
        type === 'receivable' ? 'Entrada registrada!' : 'Saída registrada!',
      );
      router.back();
    } else {
      toast.error('Erro', res.error);
    }
  }, [validate, type, description, router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerIcon}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Lançamento rápido
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.typeSwitch,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.border,
              },
            ]}
          >
            <TypeBtn
              label="Entrada"
              icon="arrow-down-outline"
              active={type === 'receivable'}
              color={colors.success}
              onPress={() => setType('receivable')}
              colors={colors}
            />
            <TypeBtn
              label="Saída"
              icon="arrow-up-outline"
              active={type === 'payable'}
              color={colors.error}
              onPress={() => setType('payable')}
              colors={colors}
            />
          </View>

          <Input
            label="Valor (R$)"
            placeholder="0,00"
            value={amount}
            onChangeText={(v) => setAmount(maskMoneyBR(v))}
            keyboardType="numeric"
            error={errors.amount}
          />

          <Input
            label="Descrição"
            placeholder="Ex: Aluguel, venda balcão, etc."
            value={description}
            onChangeText={setDescription}
            error={errors.description}
          />

          <Input
            label="Data"
            placeholder="DD/MM/AAAA"
            value={date}
            onChangeText={(v) => setDate(maskDateBR(v))}
            keyboardType="numeric"
            error={errors.date}
          />

          <Button
            title={
              type === 'receivable'
                ? 'Registrar entrada'
                : 'Registrar saída'
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function TypeBtn({
  label,
  icon,
  active,
  color,
  onPress,
  colors,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  color: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.typeBtn,
        active && { backgroundColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? '#fff' : colors.textSecondary}
      />
      <Text
        style={[
          styles.typeBtnText,
          {
            color: active ? '#fff' : colors.textSecondary,
            fontWeight: active ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerIcon: { padding: SPACING.sm, minWidth: 42 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
  typeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  typeBtnText: { fontSize: FONT_SIZE.sm },
});
