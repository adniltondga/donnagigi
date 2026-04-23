# agLivre — Extensão Chrome

Injeta custo da mercadoria e lucro real na listagem de anúncios do Mercado Livre (`/anuncios`), consumindo a API do agLivre.

## Como testar (dev, sem publicar)

1. Abra `chrome://extensions` no Chrome.
2. Ative **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem pacote** e selecione a pasta `extension/` deste repo.
4. Fixe a extensão na barra (ícone de quebra-cabeça → alfinete).
5. Clique no ícone → **Entrar** com email/senha do agLivre.
6. (Opcional) Em **Servidor** dentro do popup, troque a URL da API se estiver rodando local (`http://localhost:3000`).
7. Abra `https://www.mercadolivre.com.br/anuncios#label=active`. Cada card ganha um bloco `agLivre` com **Custo** e **Lucro**.

## Edição inline

Clique em **Custo** no card → abre um input → digite o valor → **Enter** salva. O PUT `/api/extension/costs` faz:
- Upsert em `MLProductCost` (por `mlListingId`).
- Atualiza retroativamente `Bill.productCost` de vendas daquele listing que ainda estavam sem custo.

## Lucro com variações

Quando o card mostra **"R$ X a R$ Y"** (preços diferentes por variação), a extensão calcula a **faixa** de lucro: `R$ (X − custo) – R$ (Y − custo)`.

## Estrutura

```
extension/
├── manifest.json   MV3: permissões, popup, content_script
├── config.js       endpoints + helpers de storage (usado pelo SW)
├── background.js   service worker — login, fetch autenticado, cache em chrome.storage
├── popup.html/css  UI do popup (login/logout)
├── popup.js
├── content.js      injeta o painel em cada card de /anuncios
└── styles.css      visual do painel (paleta roxa agLivre)
```

## Backend (endpoints novos)

- `POST /api/extension/login` — devolve JWT (30d) no JSON.
- `POST /api/extension/costs` — lote: `{listingIds: string[]} → {costs: {mlid: number}}`.
- `PUT  /api/extension/costs` — upsert inline: `{mlListingId, productCost, title?, aplicarRetroativo?}`.

Todos com CORS liberado (`*`) e auth via `Authorization: Bearer <jwt>`. Validação de Bearer em `src/lib/extension-auth.ts`.

## Ícones

Ainda sem ícones — o Chrome usa placeholder cinza. Pra adicionar, crie `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` e restaure o bloco `icons` no `manifest.json`.

## Seletores ML

O content script usa a âncora `"Selecionar anúncio"` (texto presente em todo card) e sobe no DOM até o ancestral que tem exatamente um `#MLB...`. Se o ML mudar esse texto, ajustar `findCards()` em `content.js`.

Debug: no console de `/anuncios`, rode `window.__aglivreDebug.findCards()` pra ver quais cards a extensão detectou.
