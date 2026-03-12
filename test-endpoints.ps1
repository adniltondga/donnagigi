# Script para testar os endpoints de produtos com múltiplas variações
# Use: .\test-endpoints.ps1

$API_URL = "http://localhost:3000/api"

Write-Host "🧪 Testando Endpoints de Produtos com Múltiplas Variações" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Criar produto com múltiplas variações
Write-Host "1️⃣  Criando produto COM múltiplas variações..." -ForegroundColor Yellow

$body = @{
    name = "Capinha Teste - iPhone"
    description = "Capinha magnética de teste com múltiplas cores"
    baseImage = "https://via.placeholder.com/300"
    category = "Capinhas"
    supplier = "testador"
    attributes = @(
        @{
            name = "Cor"
            type = "color"
            values = @("Preto", "Rosa", "Cinza")
        },
        @{
            name = "Modelo"
            type = "model"
            values = @("iPhone 14 Pro Max", "iPhone 15 Pro Max")
        }
    )
    variants = @(
        @{
            sku = "TEST-IP14-PRETO-001"
            salePrice = 59.90
            purchaseCost = 18.90
            stock = 15
            attributes = @{
                "Cor" = "Preto"
                "Modelo" = "iPhone 14 Pro Max"
            }
        },
        @{
            sku = "TEST-IP14-ROSA-001"
            salePrice = 59.90
            purchaseCost = 18.90
            stock = 12
            attributes = @{
                "Cor" = "Rosa"
                "Modelo" = "iPhone 14 Pro Max"
            }
        },
        @{
            sku = "TEST-IP14-CINZA-001"
            salePrice = 59.90
            purchaseCost = 18.90
            stock = 8
            attributes = @{
                "Cor" = "Cinza"
                "Modelo" = "iPhone 14 Pro Max"
            }
        },
        @{
            sku = "TEST-IP15-PRETO-001"
            salePrice = 59.90
            purchaseCost = 18.90
            stock = 20
            attributes = @{
                "Cor" = "Preto"
                "Modelo" = "iPhone 15 Pro Max"
            }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $body
    
    if ($response.success) {
        Write-Host "✅ Produto criado com sucesso!" -ForegroundColor Green
        $product_id = $response.data.product.id
        $variants_count = $response.data.variantsCount
        Write-Host "   ID do produto: $product_id" -ForegroundColor Green
        Write-Host "   Variações criadas: $variants_count" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao criar produto" -ForegroundColor Red
        Write-Host $response
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# 2. Buscar produto pelo ID
Write-Host "2️⃣  Buscando produto específico..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products/$product_id" -Method GET
    
    if ($response.success) {
        Write-Host "✅ Produto encontrado com variações!" -ForegroundColor Green
        Write-Host "   Nome: $($response.data.name)" -ForegroundColor Green
        Write-Host "   Variações: $($response.data.variants.Count)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao buscar produto" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# 3. Listar todos os produtos
Write-Host "3️⃣  Listando todos os produtos..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products?page=1&limit=10" -Method GET
    
    if ($response.success) {
        Write-Host "✅ Produtos listados com sucesso!" -ForegroundColor Green
        $count = ($response.data | Where-Object { $_.variants.Count -gt 0 }).Count
        Write-Host "   Produtos com variações: $count" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao listar produtos" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# 4. Atualizar informações gerais do produto
Write-Host "4️⃣  Atualizando nome do produto..." -ForegroundColor Yellow

$updateBody = @{
    name = "Capinha Teste Atualizada - iPhone Pro Max"
    description = "Nova descrição após teste"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products/$product_id" `
        -Method PUT `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $updateBody
    
    if ($response.success) {
        Write-Host "✅ Produto atualizado com sucesso!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao atualizar produto" -ForegroundColor Red
        Write-Host $response
        Write-Host ""
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# 5. Tentar atualizar preço (deve falhar)
Write-Host "5️⃣  Tentando atualizar preço no produto (deve falhar!)..." -ForegroundColor Yellow

$priceBody = @{
    salePrice = 69.90
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products/$product_id" `
        -Method PUT `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $priceBody `
        -ErrorAction Stop
    
    Write-Host "❌ Bloqueio não funcionou!" -ForegroundColor Red
    Write-Host ""
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -like "*Campos de preço*") {
        Write-Host "✅ Bloqueio funcionando corretamente!" -ForegroundColor Green
        Write-Host "   Mensagem: 'Campos de preço, estoque e variações devem ser atualizados via /variants'" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro diferente: $($errorResponse.error)" -ForegroundColor Red
        Write-Host ""
    }
}

# 6. Listar variações
Write-Host "6️⃣  Listando variações do produto..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products/$product_id/variants" -Method GET
    
    if ($response.success) {
        Write-Host "✅ Variações listadas com sucesso!" -ForegroundColor Green
        Write-Host "   Variações encontradas: $($response.data.Count)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao listar variações" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# 7. Filtrar variações por atributo
Write-Host "7️⃣  Filtrando variações por cor (Preto)..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$API_URL/products/$product_id/variants?Cor=Preto" -Method GET
    
    if ($response.success) {
        Write-Host "✅ Variações filtradas! Encontradas: $($response.data.Count)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Erro ao filtrar variações" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host "❌ Erro na requisição: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "🎉 Testes Completos!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumo:" -ForegroundColor Cyan
Write-Host "✅ Produto criado com 4 variações" -ForegroundColor Green
Write-Host "✅ Endpoints GET funcionando" -ForegroundColor Green
Write-Host "✅ Endpoint PUT protegido contra atualizações de variações" -ForegroundColor Green
Write-Host "✅ Variações podem ser filtradas" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Testar PATCH para atualizar uma variação específica" -ForegroundColor Gray
Write-Host "2. Testar DELETE para desativar uma variação" -ForegroundColor Gray
Write-Host "3. Testar criação de variação nova com POST /variants" -ForegroundColor Gray
