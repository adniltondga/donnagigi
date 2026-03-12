#!/usr/bin/env bash
# Comandos Úteis para Trabalhar com Variações de Produtos

# ============================================================
# 📊 VERIFICAR STATUS
# ============================================================

# Ver status das migrações
echo "# Verificar migrações"
npx prisma migrate status

# Ver schema do banco
echo "# Abrir Prisma Studio (UI gráfica)"
npx prisma studio

# ============================================================
# 🌱 POPULAR DADOS
# ============================================================

# Executar seed de exemplo (15 variações)
echo "# Criar dados de exemplo"
ts-node seed-product-variants.ts

# Ou com npm scripts (se tiver configurado)
npm run seed:product-variants

# ============================================================
# 🔍 CONSULTAS ÚTEIS (TypeScript/Node)
# ============================================================

# Buscar um produto com todas as variações
cat > query-product.ts << 'EOF'
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const product = await prisma.product.findFirst({
    include: {
      variants: {
        include: {
          attributes: {
            include: { attributeValue: true }
          }
        }
      }
    }
  })
  console.log(JSON.stringify(product, null, 2))
}

main().then(() => process.exit(0))
EOF

ts-node query-product.ts

# ============================================================
# 📝 CRIAR/ATUALIZAR VARIAÇÕES
# ============================================================

cat > create-variant.ts << 'EOF'
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Encontrar um produto
  const product = await prisma.product.findFirst()
  
  if (!product) {
    console.log("Nenhum produto encontrado!")
    return
  }

  // Criar nova variação
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `NEW-SKU-${Date.now()}`,
      salePrice: 99.90,
      purchaseCost: 30.00,
      stock: 20
    }
  })

  console.log("✅ Variação criada:", variant)
}

main().then(() => process.exit(0))
EOF

ts-node create-variant.ts

# ============================================================
# 🧪 TESTAR ENDPOINTS
# ============================================================

# Listar variações de um produto
echo "# Listar variações"
curl http://localhost:3000/api/products/[PRODUCT_ID]/variants | jq

# Filtrar por atributo
echo "# Filtrar variações por cor"
curl "http://localhost:3000/api/products/[PRODUCT_ID]/variants?cor=Preto" | jq

# Criar variação via API
echo "# Criar nova variação"
curl -X POST http://localhost:3000/api/products/[PRODUCT_ID]/variants \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "NEW-123",
    "salePrice": 59.90,
    "purchaseCost": 18.90,
    "stock": 20,
    "attributes": {
      "Cor": "Azul",
      "Modelo iPhone": "iPhone 15 Pro Max"
    }
  }'

# Atualizar estoque de uma variação
echo "# Atualizar estoque"
curl -X PATCH http://localhost:3000/api/products/[PRODUCT_ID]/variants/[VARIANT_ID] \
  -H "Content-Type: application/json" \
  -d '{ "stock": 50 }'

# ============================================================
# 🔍 BUSCAR NO CÓDIGO
# ============================================================

# Encontrar todas as referências a "product.salePrice" (precisa atualizar)
echo "# Encontrar campo antigo: salePrice"
grep -r "product\.salePrice" src/ --include="*.ts" --include="*.tsx"

# Encontrar todas as referências a "product.stock" (precisa atualizar)
echo "# Encontrar campo antigo: stock"
grep -r "product\.stock" src/ --include="*.ts" --include="*.tsx"

# Encontrar referências a "productId" em MLProduct
echo "# Encontrar productId em MLProduct"
grep -r "productId" src/ --include="*.ts" | grep -i "ml"

# ============================================================
# 📊 RELATÓRIOS
# ============================================================

cat > report-variants.ts << 'EOF'
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    include: {
      variants: true,
      attributes: true
    }
  })

  console.log("\n📊 RELATÓRIO DE VARIAÇÕES\n")
  
  for (const product of products) {
    console.log(`\n${product.name}`)
    console.log(`├─ Total de variações: ${product.variants.length}`)
    console.log(`├─ Total de atributos: ${product.attributes.length}`)
    
    const totalStock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    console.log(`├─ Estoque total: ${totalStock}`)
    
    const totalValue = product.variants.reduce((sum, v) => sum + (v.salePrice * (v.stock || 0)), 0)
    console.log(`└─ Valor total em estoque: R$ ${totalValue.toFixed(2)}`)
  }
}

main().then(() => process.exit(0))
EOF

ts-node report-variants.ts

# ============================================================
# 🧹 LIMPEZA
# ============================================================

# Desativar todas as variações de um produto
cat > disable-variants.ts << 'EOF'
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const productId = process.argv[2]
  
  if (!productId) {
    console.log("Uso: ts-node disable-variants.ts <PRODUCT_ID>")
    return
  }

  const result = await prisma.productVariant.updateMany({
    where: { productId },
    data: { active: false }
  })

  console.log(`✅ ${result.count} variações desativadas`)
}

main().then(() => process.exit(0))
EOF

ts-node disable-variants.ts PRODUCT_ID

# ============================================================
# 🔧 DESENVOLVIMENTO
# ============================================================

# Resetar banco (CUIDADO! Deleta tudo)
echo "# ⚠️  RESETAR BANCO DE DADOS"
# npx prisma migrate reset

# Gerar Prisma Client
echo "# Regererar tipos Prisma"
npx prisma generate

# Verificar erros TypeScript
echo "# Verificar erros de tipo"
npx tsc --noEmit

# ============================================================
# 📚 DOCUMENTAÇÃO
# ============================================================

echo "Arquivos importantes:"
echo "├─ VARIANTS_README.md - Guia rápido"
echo "├─ PRODUCT_VARIANTS.md - Documentação técnica"
echo "├─ MIGRATION_GUIDE.md - Como adaptar código"
echo "├─ TODO_FIXES.md - Próximas tarefas"
echo "├─ src/lib/variants.ts - Utilitários"
echo "└─ src/app/api/products/[id]/variants/route.ts - Endpoints"

echo "\n✅ Pronto para usar!"
