# 🎯 GUIA RÁPIDO - SINCRONIZAR SEU ML

**⏱️ Tempo total: ~2 minutos**

---

## 1️⃣ Acesse o Dashboard

```
http://localhost:3000/api/ml/dashboard
```

🎨 **Interface amigável com buttons de ação**

---

## 2️⃣ Clique em "FAZER LOGIN NO ML"

Você será redirecionado ao Mercado Livre.

**Na página do ML:**
- ✅ Faça login com sua conta
- ✅ Clique em "Autorizar"
- ✅ Você será redirecionado automaticamente

---

## 3️⃣ Pronto! Seu token foi salvo

Volte ao Dashboard e refresh a página (F5)

Você verá: **✅ AUTENTICADO**

---

## 4️⃣ Listar seus produtos

Clique em **"📦 Listar Produtos"**

Ou via terminal:
```bash
curl http://localhost:3000/api/ml/lista-reais
```

---

## 5️⃣ Importar no seu sistema

Copie o array de `produtos` retornado

```bash
curl -X POST http://localhost:3000/api/ml/import-batch \
  -H "Content-Type: application/json" \
  -d '{"produtos": [...]}'
```

---

## 6️⃣ Ver sincronizados

```bash
curl http://localhost:3000/api/products
```

✅ **Seus produtos do ML agora estão no sistema local!**

---

## 📞 Endpoints úteis

| Ação | Comando |
|------|---------|
| Dashboard | `http://localhost:3000/api/ml/dashboard` |
| Status | `curl http://localhost:3000/api/ml/status` |
| Listar ML | `curl http://localhost:3000/api/ml/lista-reais` |
| Ver Locais | `curl http://localhost:3000/api/products` |
| Guia | `curl http://localhost:3000/api/ml/guia` |

---

## ❓ Problemas?

**"Não autenticado"**
- Clique em "FAZER LOGIN NO ML" no dashboard
- Faça login com sua conta

**"Erro ao buscar produtos"**
- Verifique se o token expirou: `curl http://localhost:3000/api/ml/status`
- Se expirou, faça login novamente

**"Vai importar todos os produtos?"**
- Sim! Mas você pode editar antes de fazer POST

---

## 🎉 Pronto!

Você agora tem seus produtos do Mercado Livre sincronizados no sistema!

**Próximo**: Gerenciar, atualizar estoque, e sincronizar em tempo real (PARTE 5)
