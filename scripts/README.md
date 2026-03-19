# Scripts de Teste

## test-variant-price.js

Script para testar automaticamente se o `salePrice` das variações está sendo salvo corretamente no banco de dados.

### Como usar:

1. **Iniciar o servidor:**
```bash
npm run dev
```

2. **Em outro terminal, rodar o teste:**
```bash
node scripts/test-variant-price.js
```

### O que o script faz:

1. ✅ Cria um produto com 2 variações com preços diferentes
2. ✅ Mostra os dados enviados
3. ✅ Mostra o response da criação
4. ✅ Busca o produto novamente no banco de dados
5. ✅ Compara o preço enviado vs o preço salvo
6. ✅ Gera um relatório de sucesso ou erro

### Saída esperada:

```
1️⃣ Criando produto de teste...

📤 Enviando dados:
{
  name: "Teste Preço Variação 1234567890",
  ...
  variants: [
    { cod: 'TEST-VAR-001', salePrice: 99.99, ... },
    { cod: 'TEST-VAR-002', salePrice: 120.00, ... }
  ]
}

✅ Produto criado com ID: cm...xxx

3️⃣ Validando preços das variações salvos:

   Variação 1 (TEST-VAR-001):
     - Enviado: R$ 99.99
     - Salvo:   R$ 99.99
     - Status:  ✅ OK

   Variação 2 (TEST-VAR-002):
     - Enviado: R$ 120.00
     - Salvo:   R$ 120.00
     - Status:  ✅ OK

==================================================
✅ TESTE PASSOU: Todos os preços foram salvos corretamente!
==================================================
```

### Se o teste falhar:

O script vai mostrar:
```
❌ TESTE FALHOU: Alguns preços não foram salvos corretamente!

🔍 Possíveis problemas:
   1. O salePrice está chegando como 0 ou undefined
   2. O CurrencyInput não está convertendo corretamente
   3. A API POST não está processando o salePrice
```

### Debug:

Veja os logs do terminal do servidor enquanto o teste roda para verificar:
- Se os console.logs estão aparecendo
- Qual é o valor exato do `salePrice` sendo recebido
- Se há algum erro na validação
