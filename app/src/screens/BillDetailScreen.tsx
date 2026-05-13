import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { Input, Button, ConfirmDialog } from '@/components';
import { billsService } from '@/services';
import { toast } from '@/utils/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type { Bill } from '@/types';

interface Props {
  billId: string;
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

function isoToBR(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
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

function numberToMoneyBR(value: number): string {
  return value
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export default function BillDetailScreen({ billId }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hydrate = useCallback((b: Bill) => {
    setBill(b);
    setDescription(b.description);
    setAmount(numberToMoneyBR(b.amount));
    setDueDate(isoToBR(b.dueDate));
    setNotes(b.notes ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await billsService.detail(billId);
    setLoading(false);
    if (res.success) {
      hydrate(res.data);
    } else {
      toast.error('Erro', res.error);
      router.back();
    }
  }, [billId, hydrate, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    const value = moneyToNumber(amount);
    if (value <= 0) next.amount = 'Informe um valor';
    if (!description.trim() || description.trim().length < 2)
      next.description = 'Descrição muito curta';
    const iso = brDateToISO(dueDate);
    if (!iso) next.dueDate = 'Data inválida (DD/MM/AAAA)';
    setErrors(next);
    return Object.keys(next).length === 0 ? { value, iso: iso! } : null;
  }, [amount, description, dueDate]);

  const handleSave = useCallback(async () => {
    const ok = validate();
    if (!ok || !bill) return;
    setSubmitting(true);
    const res = await billsService.update(bill.id, {
      description: description.trim(),
      amount: ok.value,
      dueDate: ok.iso,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (res.success) {
      hydrate(res.data);
      toast.success('Conta atualizada');
    } else {
      toast.error('Erro', res.error);
    }
  }, [validate, bill, description, notes, hydrate]);

  const handleMarkPaid = useCallback(async () => {
    if (!bill) return;
    setPaying(true);
    const res = await billsService.markPaid(bill.id);
    setPaying(false);
    if (res.success) {
      hydrate(res.data);
      toast.success(
        bill.type === 'payable' ? 'Conta paga!' : 'Recebimento registrado!',
      );
    } else {
      toast.error('Erro', res.error);
    }
  }, [bill, hydrate]);

  const handleDelete = useCallback(async () => {
    if (!bill) return;
    setDeleting(true);
    const res = await billsService.remove(bill.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (res.success) {
      toast.success('Conta excluída');
      router.back();
    } else {
      toast.error('Erro', res.error);
    }
  }, [bill, router]);

  const statusInfo = (() => {
    if (!bill) return { label: '—', color: colors.textMuted };
    if (bill.status === 'paid')
      return { label: 'Paga', color: colors.success };
    if (bill.status === 'cancelled')
      return { label: 'Cancelada', color: colors.textMuted };
    const due = new Date(bill.dueDate);
    due.setHours(23, 59, 59, 999);
    if (due.getTime() < Date.now())
      return { label: 'Vencida', color: colors.error };
    return { label: 'Pendente', color: colors.warning };
  })();

  const typeLabel = bill?.type === 'payable' ? 'A pagar' : 'A receber';

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
          Detalhe da conta
        </Text>
        <TouchableOpacity
          onPress={() => setConfirmDelete(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerIcon}
          disabled={loading || !bill}
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={loading || !bill ? colors.textMuted : colors.error}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !bill ? null : (
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
                styles.summary,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Tipo
                </Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                  {typeLabel}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Status
                </Text>
                <View style={styles.statusWrap}>
                  <View
                    style={[styles.statusDot, { backgroundColor: statusInfo.color }]}
                  />
                  <Text
                    style={[styles.summaryValue, { color: statusInfo.color }]}
                  >
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
              {bill.category ? (
                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.textSecondary }]}
                  >
                    Categoria
                  </Text>
                  <Text
                    style={[styles.summaryValue, { color: colors.textPrimary }]}
                  >
                    {bill.category}
                  </Text>
                </View>
              ) : null}
              {bill.status === 'paid' && bill.paidDate ? (
                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.textSecondary }]}
                  >
                    Paga em
                  </Text>
                  <Text
                    style={[styles.summaryValue, { color: colors.textPrimary }]}
                  >
                    {formatDate(bill.paidDate)}
                  </Text>
                </View>
              ) : null}
              {typeof bill.refundedAmount === 'number' && bill.refundedAmount > 0 ? (
                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.textSecondary }]}
                  >
                    Devolvido
                  </Text>
                  <Text
                    style={[styles.summaryValue, { color: colors.error }]}
                  >
                    {formatCurrency(bill.refundedAmount)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Input
              label="Descrição"
              value={description}
              onChangeText={setDescription}
              error={errors.description}
              editable={bill.status === 'pending'}
            />

            <Input
              label="Valor (R$)"
              value={amount}
              onChangeText={(v) => setAmount(maskMoneyBR(v))}
              keyboardType="numeric"
              error={errors.amount}
              editable={bill.status === 'pending'}
            />

            <Input
              label={bill.type === 'payable' ? 'Vencimento' : 'Data prevista'}
              value={dueDate}
              onChangeText={(v) => setDueDate(maskDateBR(v))}
              keyboardType="numeric"
              error={errors.dueDate}
              editable={bill.status === 'pending'}
            />

            <Input
              label="Observações"
              value={notes}
              onChangeText={setNotes}
              placeholder="Opcional"
              multiline
              numberOfLines={3}
              editable={bill.status === 'pending'}
            />

            {bill.status === 'pending' ? (
              <>
                <Button
                  title="Salvar alterações"
                  onPress={handleSave}
                  loading={submitting}
                  disabled={submitting || paying || deleting}
                />
                <Button
                  title={
                    bill.type === 'payable'
                      ? 'Marcar como paga'
                      : 'Marcar como recebida'
                  }
                  variant="outline"
                  onPress={handleMarkPaid}
                  loading={paying}
                  disabled={submitting || paying || deleting}
                />
              </>
            ) : (
              <Text
                style={[styles.readOnly, { color: colors.textMuted }]}
              >
                Conta {statusInfo.label.toLowerCase()} — não pode ser editada.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title="Excluir conta?"
        description={
          bill
            ? `${bill.description}\n${formatCurrency(bill.amount)}\nEsta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
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
  headerIcon: { padding: SPACING.sm, minWidth: 42, alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
  summary: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: FONT_SIZE.xs },
  summaryValue: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  readOnly: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
});
