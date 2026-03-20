# ✅ Sincronização Automática Implementada

## 📋 Resumo do que foi criado

### 1. **Função Compartilhada de Sincronização**
📁 `src/lib/auto-sync-ml.ts`
- `syncMLProductToDB()` - Sincroniza um produto do ML
- `syncMLVariants()` - Sincroniza variações de um produto
- `syncAllMLProducts()` - Sincroniza todos os produtos

### 2. **Webhook - Real-Time**
📁 `src/app/api/ml/webhook/route.ts`
- Recebe notificações em tempo real do Mercado Livre
- Tópicos suportados: `item`, `order`, `payment`
- Responde em < 5s (requisito do ML)
- URL: `https://seu-dominio.com/api/ml/webhook`

### 3. **Polling - Periódico**
📁 `src/app/api/ml/polling-sync/route.ts`
- Sincroniza todos os produtos a cada X minutos
- Requer token secreto para segurança
- Pode ser chamado por:
  - EasyCron.com
  - GitHub Actions
  - Cron job do servidor
- URL: `https://seu-dominio.com/api/ml/polling-sync?token=SEU_TOKEN`

### 4. **GitHub Actions Workflow**
📁 `.github/workflows/ml-sync.yml`
- Executa automaticamente a cada 15 minutos
- Gratuito e sem configuração externa
- Permite disparada manual
- Inclui tratamento de erros e logs

### 5. **Documentação Completa**
📁 `docs/ML_AUTO_SYNC.md`
- Setup passo-a-passo
- Múltiplas opções (Webhook, Polling, EasyCron, GitHub)
- Troubleshooting
- Endpoints disponíveis

### 6. **Script de Setup Rápido**
📁 `setup-auto-sync.sh`
- Gera token secreto automaticamente
- Instruções para configurar no GitHub
- Instruções para configurar Webhook no ML

---

## 🚀 Como Usar

### Opção 1: GitHub Actions (Recomendado - Mais Fácil)

```bash
# 1. Adicione ao .env.local
ML_POLLING_SECRET=seu-token-secreto

# 2. Configure secrets no GitHub
# Settings → Secrets and variables → Actions
# - ML_SYNC_URL: https://seu-dominio.com/api/ml/polling-sync
# - ML_POLLING_SECRET: seu-token-secreto

# 3. Done! Vai sincronizar a cada 15 minutos automaticamente
```

### Opção 2: Webhook + EasyCron

```bash
# 1. Configure Webhook no ML:
# https://www.mercadolibre.com/developers/panel
# → Sua App → Notificações e Webhooks
# → URL: https://seu-dominio.com/api/ml/webhook

# 2. Configure Polling como fallback (EasyCron):
# https://www.easycron.com
# → Add Job
# → URL: https://seu-dominio.com/api/ml/polling-sync?token=seu-token
# → Every 15 minutes
```

### Opção 3: Apenas Webhook
```bash
# Registre no ML e pronto!
# Sincronização em tiempo real quando produtos mudam
# URL: https://seu-dominio.com/api/ml/webhook
```

---

## ✅ Teste Manual

### Testar Polling
```bash
curl -X POST \
  "http://localhost:3000/api/ml/polling-sync?token=seu-token-secreto"
```

Resposta esperada:
```json
{
  "status": "success",
  "timestamp": "2026-03-20T...",
  "sync_result": {
    "success": true,
    "total": 26,
    "synced": 24,
    "failed": 0
  }
}
```

### Testar Webhook (Validação)
ML faz uma requisição GET com `?challenge=...`, e o endpoint responde com `{challenge: "..."}`.

---

## 📊 O que Sincroniza

Quando um novo anúncio é criado no ML, o sistema sincroniza automaticamente:

1. ✅ ID do produto (MLB...)
2. ✅ Nome/Título
3. ✅ Preço
4. ✅ Status (ativo/inativo)
5. ✅ Quantidade em estoque
6. ✅ Variações (cores, tamanhos, etc)
7. ✅ Imagens
8. ✅ Descrição

---

## ⏱️ Frequências Recomendadas

| Intervalo | Caso de Uso |
|-----------|-----------|
| 5-10 min | Alto volume de vendas |
| 15 min | Recomendado (default) |
| 30 min | Vendas moderadas |
| 1 hora | Vendas baixas |

---

## 🔐 Segurança

- ✅ Token secreto para validar requisições de polling
- ✅ Validação de seller_id no webhook
- ✅ Tratamento de rate limits do ML
- ✅ Logs de auditoria com `[WEBHOOK]` e `[POLLING]`

---

## 🐛 Troubleshooting

### Variável de ambiente não configurada
```bash
# Adicione a .env.local:
ML_POLLING_SECRET=seu-token-super-secreto
```

### Webhook não funciona
1. Verifique URL pública: `https://seu-dominio.com/api/ml/webhook`
2. Teste com: `curl -v https://seu-dominio.com/api/ml/webhook`
3. Veja logs: `[WEBHOOK]` no console

### Polling falha
1. Verifique token: `?token=seu-token`
2. Verifique integração não expirou (token ML válido)
3. Teste manual: `/api/ml/polling-sync?token=...`

---

## 📚 Próximas Melhorias (Opcional)

- [ ] Dashboard com logs de sincronização
- [ ] Alertas via email quando sincronização falha
- [ ] Histórico de mudanças de produtos
- [ ] Delta sync (sincronizar só mudanças, não tudo)

---

## 🎯 Status

- ✅ Webhook implementado
- ✅ Polling implementado
- ✅ GitHub Actions workflow criado
- ✅ Documentação completa
- ⏳ Aguardando setup do usuário

**Próximo passo**: Configure as secrets no GitHub e teste!

