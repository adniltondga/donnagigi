# 🔄 Sincronização Automática com Mercado Livre

Este documento explica como configurar a sincronização automática de produtos com o Mercado Livre usando **Webhooks** e **Polling**.

## 📌 Visão Geral

Existem 2 mecanismos de sincronização:

### 1. **Webhooks** (Recomendado - Real-Time)
- ML notifica seu sistema quando há mudanças
- Latência: Imediata (segundos)
- Implementação: `/api/ml/webhook`
- **Vantagem**: Real-time, sem overhead constante
- **Desvantagem**: Requer configuração no painel do ML

### 2. **Polling** (Fallback - Periódico)
- Seu sistema verifica ML a cada X minutos
- Latência: Até X minutos
- Implementação: `/api/ml/polling-sync`
- **Vantagem**: Funciona sem configuração no ML
- **Desvantagem**: Pode perder mudanças rápidas

---

## 🔧 Setup - Webhook

### Passo 1: Registrar Webhook no ML

1. Acesse: https://www.mercadolibre.com/developers/panel
2. Vá para "Aplicações" → Sua App
3. Em "Aplicações", procure "Notificações e Webhooks"
4. Clique em "Agregar notificación"
5. Preencha:
   - **URL**: `https://seu-dominio.com/api/ml/webhook`
   - **Tópicos**: Selecione `item` (produtos)
   - Salve

### Passo 2: Testar Webhook (Opcional)

```bash
# ML fará uma requisição GET com ?challenge=...
# Seu endpoint responde com {challenge: "..."}
# Se funcionar, ML começa a enviar notificações POST
```

---

## ⏰ Setup - Polling Automático

### Opção 1: EasyCron.com (Recomendado)

1. Acesse: https://www.easycron.com
2. Faça login ou crie conta
3. Clique em "Add Cron Job"
4. Preencha:
   - **URL**: `https://seu-dominio.com/api/ml/polling-sync?token=SEU_TOKEN_SECRETO`
   - **Frequency**: `Every 15 minutes`
   - **HTTP Method**: `POST`
5. Salve

**⚠️ Importante**: Defina a variável de ambiente:

```env
# .env.local
ML_POLLING_SECRET=seu-token-super-secreto-muito-seguro
```

### Opção 2: GitHub Actions (Gratuito)

1. Crie arquivo `.github/workflows/ml-sync.yml`:

```yaml
name: ML Auto Sync

on:
  schedule:
    # Executar a cada 15 minutos
    - cron: '*/15 * * * *'
  workflow_dispatch:  # Permite executar manualmente

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ML Sync
        run: |
          curl -X POST "${{ secrets.ML_SYNC_URL }}?token=${{ secrets.ML_POLLING_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

2. No GitHub, vá para:
   - Settings → Secrets and variables → Actions
   - Adicione:
     - `ML_SYNC_URL`: `https://seu-dominio.com/api/ml/polling-sync`
     - `ML_POLLING_SECRET`: Seu token secreto

### Opção 3: Cron Job do Servidor

Se você tem um servidor próprio:

```bash
# /etc/cron.d/ml-sync (a cada 15 minutos)
*/15 * * * * curl -X POST "https://seu-dominio.com/api/ml/polling-sync?token=SEU_TOKEN_SECRETO"
```

---

## ✅ Verificar Sincronização

### Testar Webhook (Manual)

```bash
# Simular notificação do ML
curl -X POST "http://localhost:3000/api/ml/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "/items/MLB123456789",
    "user_id": SEU_SELLER_ID,
    "topic": "item",
    "application_id": 12345,
    "timestamp": "'$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')'",
    "sent": 1,
    "attempt": 1
  }'
```

### Testar Polling (Manual)

```bash
# Executar sincronização manual
curl -X POST "http://localhost:3000/api/ml/polling-sync?token=seu-token-secreto"
```

Resposta esperada:
```json
{
  "status": "success",
  "timestamp": "2026-03-20T...",
  "sync_result": {
    "success": true,
    "total": 26,
    "synced": 2,
    "failed": 0
  }
}
```

---

## 📊 Logs

Os logs de sincronização aparecem em:
- **Webhooks**: `[WEBHOOK]` no console
- **Polling**: `[POLLING]` no console
- **Auto-sync**: `[AUTO-SYNC]` no console

Exemplo:
```
[POLLING] iniciando sincronização automática...
[AUTO-SYNC] Iniciando sincronização completa...
[AUTO-SYNC] Encontrados 26 produtos no ML
[AUTO-SYNC] Sincronização completa: 24 sucesso, 2 falhas
```

---

## 🚨 Troubleshooting

### Webhook não funciona
- Verifique URL correta: `https://seu-dominio.com/api/ml/webhook`
- Verifique firewall/URL acessível publicamente
- Logs: procure por `[WEBHOOK]`

### Polling não executa
- Verifique se token está correto: `ML_POLLING_SECRET`
- Verifique URL: `https://seu-dominio.com/api/ml/polling-sync?token=...`
- Teste com: `curl -X POST "..."`
- Logs: procure por `[POLLING]`

### Produtos não sincronizam
- Verifique token do ML não expirou (válido por 6 meses)
- Verifique seller_id correto no banco
- Tente manual: `/api/ml/sync` vs `/api/ml/polling-sync`

---

## 🎯 Recomendações

1. **Use AMBOS** (Webhook + Polling):
   - Webhook para real-time
   - Polling como fallback

2. **Intervalo de Polling**: 15 minutos é bom balance
   - ≥ 5 min: Pode sobrecarregar API do ML
   - ≤ 60 min: Pode perder mudanças

3. **Token Seguro**:
   - Use token forte: `ML_POLLING_SECRET=abc123xyz789`
   - Mude periodicamente
   - Nunca commita no Git

4. **Monitorar Logs**:
   - Configure alerts se sincronização falhar
   - Cheque status de integração regularmente

---

## 📚 Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/ml/webhook` | POST | Recebe notificações do ML |
| `/api/ml/webhook` | GET | Validação do webhook (challenge) |
| `/api/ml/polling-sync` | POST | Sincroniza todos os produtos |
| `/api/ml/polling-sync` | GET | Teste com token |
| `/api/ml/sync` | GET | Manual - sincroniza todos |

