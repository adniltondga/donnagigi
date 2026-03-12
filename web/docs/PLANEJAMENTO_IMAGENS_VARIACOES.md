# 📋 Planejamento: Upload de Imagens por Variação

## 🎯 Objetivo
Implementar upload de até 5 imagens por variação de produto com preview, validações e gerenciamento.

---

## 📊 Arquitetura Geral

```
VariationImage (Prisma Model)
├── id
├── variantId
├── productId
├── url (arquivo armazenado)
├── order (1-5, para ordenação)
└── createdAt

Frontend: ImageUploadVariant (Novo Componente)
├── Drag & Drop
├── File Input
├── Preview Cards
├── Remove Button
└── Max 5 files validation

API Routes:
├── POST   /api/variants/{variantId}/images
├── DELETE /api/variants/{variantId}/images/{imageId}
└── GET    /api/variants/{variantId}/images
```

---

## 🔧 TAREFAS

### **Fase 1: Database & Backend** ⏳

#### Tarefa 1.1: Criar Migration Prisma
- [ ] Adicionar modelo `VariantImage` ao schema.prisma
- [ ] Campos: id, variantId, productId, url, order, createdAt, updatedAt
- [ ] Relacionamento: ProductVariant.variantImages
- [ ] Executar `prisma migrate dev`

**Arquivo:** `prisma/schema.prisma`
**Modelo:**
```prisma
model VariantImage {
  id        String   @id @default(cuid())
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  variantId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  url       String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Tarefa 1.2: Setup de Armazenamento em Nuvem
- [ ] **OPÇÃO RECOMENDADA: Vercel Blob Storage** ⭐
  - Setup: Package `@vercel/blob`
  - Integração automática com Vercel deployment
  - Pros: 
    - Sem configurações extras
    - CDN global incluído
    - Escalável automaticamente
    - Preço competitivo (100GB gratuito/mês)
  - Cons: Preso ao Vercel
  - Documento: https://vercel.com/docs/storage/vercel-blob

- [ ] **OPÇÃO ALTERNATIVA: Supabase Storage**
  - Bucket: `product-variants`
  - Implementação: Client SDK
  - Pros: Open source, flexível, CDN
  - Cons: Setup conta Supabase adicional
  - Documento: https://supabase.com/docs/guides/storage

**Decision:** Usar **Vercel Blob Storage** (recomendado para Vercel)

#### Configuração Vercel Blob:
```bash
npm install @vercel/blob
```

**Variáveis de Ambiente:**
```env
# .env.local
BLOB_READ_WRITE_TOKEN=seu_token_aqui
```

**Download do Token:**
1. Acesse dashboard.vercel.com
2. Projeto → Settings → Storage
3. Create → Blob
4. Copy token

#### Tarefa 1.3: API POST - Upload de Imagens
- [ ] Criar arquivo: `src/app/api/variants/[variantId]/images/route.ts`
- [ ] Endpoint: `POST /api/variants/{variantId}/images`
- [ ] Validações:
  - Arquivo é imagem (JPEG, PNG, WebP)
  - Tamanho máx 5MB por arquivo
  - Máximo 5 arquivos por variação
  - VariantId existe no banco
- [ ] Fazer upload via **Vercel Blob**
- [ ] Retornar URL do blob (ex: `https://blob.vercelusercontent.com/...`)
- [ ] Criar registro no banco de dados com URL
- [ ] Retornar: `{ success, imageId, url }`

**Código referência:**
```typescript
import { put } from '@vercel/blob'

// No handler POST
const blob = await put(
  `variants/${variantId}/${Date.now()}-${file.name}`,
  file,
  { access: 'public' }
)

// Salvar blob.url no banco de dados
```

#### Tarefa 1.4: API DELETE - Remover Imagem
- [ ] Criar método DELETE no mesmo arquivo
- [ ] Endpoint: `DELETE /api/variants/{variantId}/images/{imageId}`
- [ ] Validações:
  - Imagem pertence à variação
  - ImageId existe no banco
- [ ] Deletar arquivo do **Vercel Blob** (usando URL armazenada)
- [ ] Remover registro do banco
- [ ] Retornar: `{ success }`

**Código referência:**
```typescript
import { del } from '@vercel/blob'

// No handler DELETE
const url = image.url // URL armazenada do blob
await del(url)

// Deletar registro do banco
```

#### Tarefa 1.5: API GET - Listar Imagens
- [ ] Criar método GET
- [ ] Endpoint: `GET /api/variants/{variantId}/images`
- [ ] Retornar lista ordenada (by order field)
- [ ] Formato: `[ { id, url, order }, ... ]`

---

### **Fase 2: Frontend - Componente** ⏳

#### Tarefa 2.1: Criar Componente ImageUploadVariant
- [ ] Arquivo: `src/components/ImageUploadVariant.tsx`
- [ ] Props:
  - `variantId`: string
  - `productId`: string
  - `onImagesChange`: (images: VariantImage[]) => void
- [ ] Estados:
  - `images`: VariantImage[]
  - `uploading`: boolean
  - `uploadProgress`: number
  - `error`: string | null
- [ ] Features:
  - Drag & Drop zone
  - File input button
  - Image preview cards
  - Remove button por imagem
  - Progress indicator durante upload
  - Validações frontend (tamanho, quantidade, tipo)
  - Limite visual: 5 imagens máx

#### Tarefa 2.2: Implementar Drag & Drop
- [ ] Usar eventos: dragover, dragenter, dragleave, drop
- [ ] Visual feedback: highlight da zona
- [ ] Mesmo handler para file input e drag drop

#### Tarefa 2.3: Implementar Preview
- [ ] Cards com:
  - Thumbnail da imagem
  - Número de ordem (1-5)
  - Ícone de loading durante upload
  - Botão X para remover
  - Feedback de sucesso/erro

#### Tarefa 2.4: Validações Frontend
- [ ] Tipo de arquivo: apenas imagens (image/*)
- [ ] Tamanho máximo: 5MB por arquivo
- [ ] Quantidade: máximo 5 arquivos
- [ ] Mensagens de erro claras

#### Tarefa 2.5: Integração com API
- [ ] Fazer upload via FormData
- [ ] Handler: `handleImageUpload(files: File[])`
- [ ] Tratamento de erros
- [ ] Atualização de estado após sucesso
- [ ] Refresh da lista de imagens

---

### **Fase 3: Integração no Formulário** ⏳

#### Tarefa 3.1: Adicionar no VariantForm
- [ ] Importar `ImageUploadVariant`
- [ ] Adicionar seção "Imagens" em cada variação
- [ ] Passar props: variantId, productId, onImagesChange
- [ ] Armazenar imagens no estado ou chamar API

#### Tarefa 3.2: Ajustar Layout do VariantForm
- [ ] Grid agora com mais espaço para imagens
- [ ] Considerar: 2 colunas (modelo, cor) + 1 seção imagens expandida
- [ ] Responsividade: mobile-friendly

#### Tarefa 3.3: Persistência de Dados
- [ ] Imagens são salvas imediatamente no upload
- [ ] Ou: Salvar apenas ao clicar "Salvar Produto"?
- [ ] Definir fluxo

---

### **Fase 4: Testes & Refinamento** ⏳

#### Tarefa 4.1: Testes Manuais
- [ ] Upload com 1 imagem ✓
- [ ] Upload com 5 imagens ✓
- [ ] Rejeitar 6ª imagem ✓
- [ ] Rejeitar arquivo > 5MB ✓
- [ ] Rejeitar arquivo não-imagem ✓
- [ ] Remover imagem ✓
- [ ] Visualizar em diferentes resoluções

#### Tarefa 4.2: Tratamento de Erros
- [ ] Conexão falha
- [ ] Arquivo corrompido
- [ ] Espaço em disco insuficiente
- [ ] Permissões de arquivo

#### Tarefa 4.3: Performance
- [ ] Comprimir imagens no upload
- [ ] Lazy loading de previews
- [ ] Otimizar renderização

---

## 📁 Estrutura de Pastas

```
src/
├── app/api/variants/
│   └── [variantId]/
│       └── images/
│           └── route.ts (POST, DELETE, GET)
├── components/
│   └── ImageUploadVariant.tsx (NOVO)
└── types/
    └── index.ts (adicionar VariantImage)

Vercel Blob Storage (nuvem):
└── /variants/
    └── {variantId}/
        ├── 1709043600000-image-1.jpg
        ├── 1709043601000-image-2.jpg
        └── ...

prisma/
├── schema.prisma (MODIFICAR)
└── migrations/
    └── 20260312_add_variant_images/
        └── migration.sql
```

**URLs armazenadas no banco:**
```
https://blob.vercelusercontent.com/hash/variants/variantId/1709043600000-image-1.jpg
https://blob.vercelusercontent.com/hash/variants/variantId/1709043601000-image-2.jpg
```

---

## 📋 Tipos TypeScript

```typescript
interface VariantImage {
  id: string
  variantId: string
  productId: string
  url: string          // /uploads/variants/{variantId}/image-{order}.jpg
  order: number        // 1-5
  createdAt: Date
  updatedAt: Date
}

interface ImageUploadVariantProps {
  variantId: string
  productId: string
  onImagesChange?: (images: VariantImage[]) => void
  maxImages?: number   // default: 5
  maxFileSize?: number // default: 5MB
}
```

---

## 🎨 UI/UX Design

### ImageUploadVariant Component Layout:
```
┌─────────────────────────────────────────────────┐
│  📸 Imagens da Variação (0/5)                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ╔════════════════════════════════════════════╗ │
│  ║  Arraste imagens aqui ou clique           ║ │
│  ║  Máximo: 5 imagens, até 5MB cada         ║ │
│  ║  Formatos: JPG, PNG, WebP                ║ │
│  ║                                          ║ │
│  ║         [ 📁 Selecionar Imagens ]        ║ │
│  ╚════════════════════════════════════════════╝ │
│                                                 │
│  Imagens Carregadas:                            │
│  ┌──────┬──────┬──────┬──────┐                │
│  │ 1    │ 2    │ 3    │ -    │                │
│  │ [IMG]│ [IMG]│ [IMG]│                       │
│  │  ❌  │  ❌  │  ❌  │                        │
│  └──────┴──────┴──────┴──────┘                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Próximos Passos

1. **Setup Vercel Blob:**
   - [ ] Instalar `npm install @vercel/blob`
   - [ ] Gerar token no dashboard Vercel
   - [ ] Adicionar `BLOB_READ_WRITE_TOKEN` em `.env.local`

2. **Implementar Fase 1** (Database)
   - [ ] Criar migration VariantImage
   - [ ] Criar API routes POST/DELETE/GET

3. **Implementar Fase 2** (Frontend)
   - [ ] Criar componente ImageUploadVariant
   - [ ] Implementar Drag & Drop
   - [ ] Integrar com Vercel Blob

4. **Testar Fase 3** (Integração)
   - [ ] Adicionar no VariantForm
   - [ ] Testes manuais

5. **Deploy em Produção**
   - [ ] Testar no Vercel
   - [ ] Confirmar CDN funcionando
   - [ ] Monitorar uso de storage

---

## ⚠️ Considerações Importantes

- **Limpeza:** Deletar imagens órfãs quando variação é removida (Cascade delete)
- **Performance:** CDN global incluso no Vercel Blob
- **Segurança:** Validar tipo MIME no backend (não confiar em extensão)
- **Token:** Manter `BLOB_READ_WRITE_TOKEN` seguro em variáveis de ambiente
- **Limites:**
  - 100GB de armazenamento/mês (plano gratuito)
  - Requerer upgrade se necessário mais
- **Fallback:** Se Vercel Blob falhar, capturar erro e informar ao usuário
- **Otimização:**
  - Vercel Blob entrega via CDN automaticamente
  - Considerar compressão WebP no frontend antes de upload
  - Lazy load de imagens no preview

