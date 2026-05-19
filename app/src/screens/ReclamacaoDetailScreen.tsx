import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts';
import { mlClaimsService } from '@/services';
import { toast } from '@/utils/toast';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';
import type {
  MLClaimDetail,
  MLClaimExpectedResolution,
  MLClaimMessage,
  MLClaimReturn,
} from '@/types';

const MAX_CHARS = 2000;

interface Props {
  claimId: string;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Strip simples de HTML. A API ML retorna mensagens com <ul>, <li>,
// <strong>, <br>, <a> — pra esse MVP, viramos tudo em texto plano com
// quebras de linha em vez de renderizar HTML.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p|ul|ol|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function senderLabel(role: string): string {
  if (role === 'respondent') return 'Você (vendedor)';
  if (role === 'complainant') return 'Comprador';
  if (role === 'mediator') return 'Mercado Livre';
  return role;
}

function senderIsMe(role: string): boolean {
  return role === 'respondent';
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    claim: 'Reclamação',
    dispute: 'Em disputa',
    return: 'Devolução',
    cancel: 'Cancelamento',
  };
  return map[stage] ?? stage;
}

function expectedResolutionLabel(key: string): string {
  const map: Record<string, string> = {
    return_product: 'Devolução do produto',
    refund: 'Reembolso',
    change_product: 'Troca do produto',
    product_not_received: 'Produto não recebido',
  };
  return map[key] ?? key;
}

function returnStatusLabel(status: string): string {
  const map: Record<string, string> = {
    to_be_agreed: 'A combinar',
    pending: 'Pendente',
    shipped: 'Em trânsito',
    delivered: 'Entregue ao vendedor',
    not_delivered: 'Não entregue',
    cancelled: 'Cancelado',
  };
  return map[status] ?? status;
}

function statusMoneyLabel(status: string): string {
  const map: Record<string, string> = {
    retained: 'Retido',
    released: 'Liberado',
    refunded: 'Estornado ao comprador',
    available: 'Disponível',
  };
  return map[status] ?? status;
}

function refundAtLabel(at: string | null): string {
  if (!at) return '—';
  const map: Record<string, string> = {
    delivered: 'Quando o produto chegar ao vendedor',
    shipped: 'Quando o produto for postado',
    accepted: 'Quando o vendedor aceitar',
  };
  return map[at] ?? at;
}

function subtypeLabel(key: string): string {
  const map: Record<string, string> = {
    return_total: 'Devolução total',
    return_partial: 'Devolução parcial',
  };
  return map[key] ?? key;
}

export default function ReclamacaoDetailScreen({ claimId }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [claim, setClaim] = useState<MLClaimDetail | null>(null);
  const [messages, setMessages] = useState<MLClaimMessage[]>([]);
  const [expectedResolutions, setExpectedResolutions] = useState<
    MLClaimExpectedResolution[]
  >([]);
  const [returnInfo, setReturnInfo] = useState<MLClaimReturn | null>(null);
  const [evidencesCount, setEvidencesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  // Padrão chat: antiga em cima, recente embaixo. A API ML não garante
  // ordem, então sort por dateCreated asc (mensagens sem timestamp ficam
  // por último — improvável, mas evita NaN no compare).
  const orderedMessages = useMemo(() => {
    const copy = [...messages];
    copy.sort((a, b) => {
      const at = a.dateCreated ?? '';
      const bt = b.dateCreated ?? '';
      return at.localeCompare(bt);
    });
    return copy;
  }, [messages]);

  const load = useCallback(async () => {
    const res = await mlClaimsService.detail(claimId);
    if (res.success) {
      setClaim(res.data.claim);
      setMessages(res.data.messages);
      setExpectedResolutions(res.data.expectedResolutions);
      setReturnInfo(res.data.return);
      setEvidencesCount(res.data.evidences?.length ?? 0);
    } else {
      toast.error('Erro ao carregar', res.error);
    }
  }, [claimId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    if (text.length > MAX_CHARS) {
      toast.error('Mensagem muito longa', `Máx. ${MAX_CHARS} caracteres`);
      return;
    }
    Alert.alert(
      'Enviar resposta?',
      'A mensagem vai pra reclamação no Mercado Livre. Não dá pra editar nem apagar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'default',
          onPress: async () => {
            setSending(true);
            const res = await mlClaimsService.sendMessage(claimId, text);
            setSending(false);
            if (res.success) {
              setDraft('');
              toast.success('Mensagem enviada');
              // Reload pra trazer a mensagem (e o que o ML eventualmente
              // adicionar — webhook pode atualizar players, status etc).
              await load();
            } else {
              toast.error('Não foi possível enviar', res.error);
            }
          },
        },
      ],
    );
  }, [claimId, draft, load, sending]);

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Reclamação #{claimId}
          </Text>
          {claim ? (
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {stageLabel(claim.stage)} ·{' '}
              {claim.status === 'opened' ? 'aberta' : claim.status}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerIcon} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {claim ? (
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <InfoRow
                  label="Pedido"
                  value={`#${claim.resourceId}`}
                  colors={colors}
                />
                <InfoRow
                  label="Motivo"
                  value={claim.reasonId ?? '—'}
                  colors={colors}
                />
                <InfoRow
                  label="Aberta em"
                  value={formatDateTime(claim.dateCreated)}
                  colors={colors}
                />
              </View>
            ) : null}

            {expectedResolutions.length > 0 ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  O que o comprador pediu
                </Text>
                {expectedResolutions.map((r, i) => (
                  <View key={`${i}-${r.dateCreated}`} style={styles.bulletRow}>
                    <Ionicons
                      name="ellipse"
                      size={6}
                      color={colors.textMuted}
                      style={{ marginTop: 7 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.bulletText, { color: colors.textPrimary }]}
                      >
                        {expectedResolutionLabel(r.expectedResolution)}
                      </Text>
                      <Text style={[styles.bulletSub, { color: colors.textMuted }]}>
                        Status: {r.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {returnInfo ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.primary + '55',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Ionicons
                    name="cube-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textPrimary }]}
                  >
                    Devolução
                  </Text>
                </View>
                <InfoRow
                  label="Status"
                  value={returnStatusLabel(returnInfo.status)}
                  colors={colors}
                />
                <InfoRow
                  label="Tipo"
                  value={subtypeLabel(returnInfo.subtype)}
                  colors={colors}
                />
                <InfoRow
                  label="Pagamento"
                  value={statusMoneyLabel(returnInfo.statusMoney)}
                  colors={colors}
                />
                <InfoRow
                  label="Estorno"
                  value={refundAtLabel(returnInfo.refundAt)}
                  colors={colors}
                />
                {returnInfo.shipments.map((s) => (
                  <View key={s.id} style={styles.shipmentBlock}>
                    {s.trackingNumber ? (
                      <>
                        <Text
                          style={[styles.shipmentLabel, { color: colors.textMuted }]}
                        >
                          Rastreio (toque e segure pra copiar)
                        </Text>
                        <Text
                          selectable
                          style={[
                            styles.trackingValue,
                            {
                              color: colors.textPrimary,
                              backgroundColor: colors.primary + '14',
                              borderColor: colors.primary + '33',
                            },
                          ]}
                        >
                          {s.trackingNumber}
                        </Text>
                      </>
                    ) : null}
                    {s.destinationCity ? (
                      <Text
                        style={[styles.shipmentSub, { color: colors.textMuted }]}
                      >
                        Destino: {s.destinationCity}
                        {s.destinationState ? ` · ${s.destinationState}` : ''}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {evidencesCount > 0 ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Ionicons
                    name="document-attach-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textPrimary }]}
                  >
                    {evidencesCount}{' '}
                    {evidencesCount === 1
                      ? 'evidência anexada'
                      : 'evidências anexadas'}
                  </Text>
                </View>
                <Text style={[styles.bulletSub, { color: colors.textMuted }]}>
                  Veja os anexos no app do Mercado Livre.
                </Text>
              </View>
            ) : null}

            {orderedMessages.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Sem mensagens ainda. Você pode iniciar a conversa abaixo.
              </Text>
            ) : (
              orderedMessages.map((m, idx) => {
                const mine = senderIsMe(m.senderRole);
                return (
                  <View
                    key={`${idx}-${m.dateCreated ?? ''}`}
                    style={[
                      styles.msgRow,
                      { justifyContent: mine ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        {
                          backgroundColor: mine
                            ? colors.primary + '22'
                            : colors.backgroundCard,
                          borderColor: mine
                            ? colors.primary + '55'
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.msgSender, { color: colors.textMuted }]}
                      >
                        {senderLabel(m.senderRole)}
                        {m.dateCreated
                          ? ` · ${formatDateTime(m.dateCreated)}`
                          : ''}
                      </Text>
                      <Text
                        style={[styles.msgBody, { color: colors.textPrimary }]}
                      >
                        {stripHtml(m.message)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.backgroundCard,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva sua resposta…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CHARS}
            style={[styles.input, { color: colors.textPrimary }]}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  !draft.trim() || sending
                    ? colors.border
                    : colors.primary,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerIcon: { padding: SPACING.sm, minWidth: 42 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  headerSub: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  infoCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  infoLabel: { fontSize: FONT_SIZE.xs },
  infoValue: { fontSize: FONT_SIZE.xs, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  bulletText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  bulletSub: { fontSize: FONT_SIZE.xs, marginTop: 2 },
  shipmentBlock: { marginTop: SPACING.sm, gap: 4 },
  shipmentLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  trackingValue: {
    fontSize: FONT_SIZE.sm,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontWeight: '700',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  shipmentSub: { fontSize: FONT_SIZE.xs },
  empty: { textAlign: 'center', paddingVertical: SPACING.lg, fontSize: FONT_SIZE.sm },
  msgRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  msgBubble: {
    maxWidth: '88%',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 4,
  },
  msgSender: { fontSize: 10, fontWeight: '600' },
  msgBody: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: FONT_SIZE.sm,
    paddingVertical: SPACING.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
