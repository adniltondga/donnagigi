# ✅ Checklist: Nova Estratégia ML - Próximos Passos

## 📌 O Que Foi Concluído

### ✅ Endpoints Criados
- [x] `/api/ml/publish` - Publicar produtos no ML
- [x] `/api/ml/sync-inventory` - Sincronizar estoque
- [x] `/api/ml/sync-price` - Sincronizar preço
- [x] Script de testes (`scripts/test-ml-new-strategy.sh`)

### ✅ Documentação
- [x] `/docs/ML_NOVA_ESTRATEGIA.md` - Estratégia completa
- [x] `/docs/ML_NOVA_ESTRATEGIA_RESUMO.md` - Resumo executivo
- [x] `/docs/ENDPOINTS_ANTIGOS_VS_NOVOS.md` - Comparação old vs new

### ✅ Banco de Dados
- [x] ProductVariant tem campos: `mlListingId`, `mlListed`, `stock`
- [x] 25 produtos já sincronizados com variações (de `/api/ml/sync`)

---

## 🔄 Fase 2: Testes Práticos

### Teste 1: Fazer curl direto nos endpoints
```bash
# Terminal 1: rodar dev server
npm run dev

# Terminal 2: testar
curl -X POST http://localhost:3000/api/ml/publish \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "clxxx...",
    "variantIds": ["clxxx..."],
    "titulo": "Chinelo Rosa",
    "categoria_ml": "246427"
  }'
```

### Teste 2: Validar que mlListingId foi salvo
```bash
# Ir para Prisma Studio
npx prisma studio

# Procurar ProductVariant onde mlListingId não é null
```

### Teste 3: Testar batch mode
```bash
# Sincronizar TODOS os estoques
curl -X POST http://localhost:3000/api/ml/sync-inventory \
  -H "Content-Type: application/json" \
  -d '{"batch": true}'

# Sincronizar TODOS os preços
curl -X POST http://localhost:3000/api/ml/sync-price \
  -H "Content-Type: application/json" \
  -d '{"batch": true}'
```

---

## 🎨 Fase 3: Integração UI

### Criar Botão "Publicar no ML" 
**Arquivo**: `src/components/ProductPublishButton.tsx`

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ProductPublishButton({ productId, isPublished }) {
  const [loading, setLoading] = useState(false);
  const [mlUrl, setMlUrl] = useState(null);

  const handlePublish = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          variantIds: [...], // get from context
          titulo: '...',
          categoria_ml: '...'
        })
      });
      
      const data = await res.json();
      
      if (data.mlUrl) {
        setMlUrl(data.mlUrl);
        toast.success('Publicado no ML!');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isPublished && mlUrl) {
    return (
      <a href={mlUrl} target="_blank" className="text-blue-600 underline">
        Ver no ML 🔗
      </a>
    );
  }

  return (
    <Button onClick={handlePublish} disabled={loading}>
      {loading ? 'Publicando...' : 'Publicar no ML'}
    </Button>
  );
}
```

### Adicionar Status Visual
- [ ] Mostrar badge "Publicado" em verde
- [ ] Mostrar badge "Rascunho" em cinza
- [ ] Mostrar badge "Erro" em vermelho

---

## 🗑️ Fase 4: Limpeza - Deprecar Endpoints Antigos

### Remover endpoints antigos:
- [ ] `/api/ml/enrich/test` - DELETE
- [ ] `/api/ml/enrich/apply` - DELETE
- [ ] `/api/ml/enrich/batch` - DELETE
- [ ] `/api/ml/map-attributes` - DELETE

### Manter endpoints (debug):
- [x] `/api/ml/debug/token-info` - MANTER
- [x] `/api/ml/debug/variations-structure` - MANTER (útil para troubleshooting)

### Documentação:
- [ ] Atualizar `/docs/INDEX.md` - remover links antigos
- [ ] Criar `/docs/DEPRECADOS.md` - listar o que foi removido
- [ ] Atualizar `.copilot-instructions` com nova estratégia

---

## 🚀 Fase 5: Testes em Produção (Opcional)

```bash
# Apenas DEPOIS de validar tudo em dev

# 1. Trocar BASE_URL em .env
ML_API_URL=https://api.mercadolibre.com (real, não simulado)

# 2. Usar token real do BD
# (já temos salvo de /api/ml/auth/callback)

# 3. Publicar 1 produto como teste
# 4. Validar que aparece no ML
# 5. Testar atualizações de preço/estoque no ML

# 6. Depois: migrar para produção com confiança
```

---

## 📊 Resumo de Status

| Tarefa | Status | Data | Notas |
|--------|--------|------|-------|
| Endpoints criados | ✅ | Hoje | Pronto para teste |
| Documentação | ✅ | Hoje | Completo |
| Testes unitários | ⏳ | Próximo | Testar cada endpoint |
| UI integrada | ⏳ | Próximo | Botão Publicar |
| Endpoints antigos removidos | ⏳ | Depois | Não remover ainda |
| Deploy em Prod | ⏳ | Futuro | Aguardar testes |

---

## 💡 Quick Links

- **Ver Endpoints**: `/docs/ENDPOINTS_ANTIGOS_VS_NOVOS.md`
- **Entender Estratégia**: `/docs/ML_NOVA_ESTRATEGIA.md`
- **Código dos Endpoints**: 
  - `/src/app/api/ml/publish/route.ts`
  - `/src/app/api/ml/sync-inventory/route.ts`
  - `/src/app/api/ml/sync-price/route.ts`
- **Testar Scripts**: `/scripts/test-ml-new-strategy.sh`

---

## 🎯 Objetivo Final

**Sistema é Fonte de Verdade**

```
┌─ Criar aqui ─┐
│   Sistema    │ ← Controla TUDO
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│ ML Recebe Atualizações  │
│ (publica automático)    │
└─────────────────────────┘
```

✅ Usuário cria produto aqui → ML recebe
✅ Usuário muda preço aqui → ML atualiza
✅ Usuário muda estoque aqui → ML sincroniza
✅ Sistema controla tudo

---

**Próximo**: Rodar testes e validar endpoints em ação! 🚀
