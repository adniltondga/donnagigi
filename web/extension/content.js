// Content script — injetado em mercadolivre.com.br/anuncios.
// Identifica cada card de anúncio, busca custo do agLivre, calcula
// lucro e desenha um painel "Custo / Lucro" dentro do card.

(() => {
  const LOG = (...a) => console.log("%c[agLivre]", "color:#7c3aed;font-weight:bold", ...a);
  const WARN = (...a) => console.warn("%c[agLivre]", "color:#dc2626;font-weight:bold", ...a);

  LOG("content script carregado em", location.href);

  const MARKER_CLASS = "aglivre-panel";
  const PROCESSED_ATTR = "data-aglivre-id";
  const MLB_RE = /#(\d{6,})\b/;

  const fmt = (v) =>
    "R$ " +
    v
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const parsePrice = (s) =>
    parseFloat(String(s).replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", "."));

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const send = (msg) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        if (!res?.ok) return reject(new Error(res?.error || "Erro"));
        resolve(res.data);
      });
    });

  /**
   * Encontra o container de cada card. Usa "Selecionar anúncio" como
   * âncora (aparece em todo card) e sobe no DOM até o ancestral que
   * contém exatamente UM "#MLBid" — esse é o card.
   */
  function findCards() {
    const cards = new Set();
    const anchors = [];
    // Estratégia 1: texto "Selecionar anúncio"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue || "").trim();
      if (t === "Selecionar anúncio") anchors.push(node.parentElement);
    }

    // Estratégia 2 (fallback): qualquer elemento folha com "#MLBid"
    if (anchors.length === 0) {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el.childElementCount > 0) continue;
        if (MLB_RE.test(el.textContent || "")) anchors.push(el);
      }
      if (anchors.length > 0) LOG("usando fallback #MLBid, achou", anchors.length, "âncoras");
    }

    for (const anchor of anchors) {
      let cur = anchor;
      let last = null;
      while (cur && cur !== document.body) {
        const txt = cur.textContent || "";
        const ids = txt.match(/#\d{6,}/g);
        if (ids && ids.length === 1) {
          last = cur;
        } else if (ids && ids.length > 1) {
          break;
        }
        cur = cur.parentElement;
      }
      if (last) {
        const m = MLB_RE.exec(last.textContent || "");
        if (m) {
          const listingId = "MLB" + m[1];
          if (last.getAttribute(PROCESSED_ATTR) !== listingId) {
            last.setAttribute(PROCESSED_ATTR, listingId);
          }
          cards.add(last);
        }
      }
    }
    return cards;
  }

  /**
   * Extrai "Você recebe" do card. Pode ser valor único (R$ 40,94) ou
   * faixa ("R$ 24,65 a R$ 28,57"). Retorna {min, max} ou null.
   *
   * Estratégia: acha o nó de texto "Você recebe" e procura o próximo
   * texto com R$; se não achar, usa a heurística de "último R$ no card".
   */
  function extractVoceRecebe(card) {
    const textNodes = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || "").trim();
      if (t) textNodes.push(t);
    }

    const parseRange = (s) => {
      const m = s.match(/R\$\s*([\d.,]+)\s*(?:a|–|-)\s*R\$\s*([\d.,]+)/i);
      if (m) return { min: parsePrice(m[1]), max: parsePrice(m[2]) };
      const single = s.match(/R\$\s*([\d.,]+)/);
      if (single) return { min: parsePrice(single[1]), max: null };
      return null;
    };

    // 1) Texto "Você recebe ... R$ X" no mesmo nó
    for (const t of textNodes) {
      if (/você recebe/i.test(t) && /R\$/.test(t)) {
        const r = parseRange(t);
        if (r) return r;
      }
    }

    // 2) Texto "Você recebe" como label separado → próximos textos com R$
    for (let i = 0; i < textNodes.length; i++) {
      if (/^você recebe/i.test(textNodes[i])) {
        for (let j = i + 1; j < Math.min(textNodes.length, i + 8); j++) {
          const r = parseRange(textNodes[j]);
          if (r) return r;
        }
      }
    }

    // 3) Fallback: detectar bloco "faixa" "R$ X,XX a R$ Y,YY" isolado
    for (const t of textNodes) {
      if (/R\$.*a\s*R\$/i.test(t)) {
        const r = parseRange(t);
        if (r) return r;
      }
    }

    return null;
  }

  function extractTitle(card) {
    // Título costuma ser o link do anúncio (um h3/h2/a próximo ao topo).
    const link = card.querySelector('a[href*="/MLB-"], a[href*="/anuncio/"]');
    if (link) return (link.textContent || "").trim().slice(0, 200);
    return null;
  }

  function computeProfit(cost, vr) {
    if (cost == null || !vr) return { text: "—", positive: null };
    if (vr.max != null && Math.abs(vr.max - vr.min) > 0.005) {
      const a = vr.min - cost;
      const b = vr.max - cost;
      return { text: `${fmt(a)} – ${fmt(b)}`, positive: a >= 0 && b >= 0 ? true : a < 0 && b < 0 ? false : null };
    }
    const p = vr.min - cost;
    return { text: fmt(p), positive: p >= 0 };
  }

  function buildPanel({ listingId, cost, vr, title }) {
    const panel = document.createElement("div");
    panel.className = MARKER_CLASS;
    panel.dataset.listingId = listingId;

    const header = document.createElement("div");
    header.className = "aglivre-panel__header";
    header.textContent = "agLivre";
    panel.appendChild(header);

    const rowCost = document.createElement("div");
    rowCost.className = "aglivre-panel__row";
    rowCost.innerHTML = `<span class="aglivre-panel__label">Custo</span>`;
    const costVal = document.createElement("button");
    costVal.type = "button";
    costVal.className = "aglivre-panel__value aglivre-panel__cost";
    costVal.title = "Clique pra editar";
    costVal.textContent = cost != null ? fmt(cost) : "Clique pra definir";
    if (cost == null) costVal.classList.add("aglivre-panel__value--empty");
    costVal.addEventListener("click", () => startEditCost(panel, { listingId, title }));
    rowCost.appendChild(costVal);
    panel.appendChild(rowCost);

    const rowProfit = document.createElement("div");
    rowProfit.className = "aglivre-panel__row";
    rowProfit.innerHTML = `<span class="aglivre-panel__label">Lucro</span>`;
    const profit = computeProfit(cost, vr);
    const profitVal = document.createElement("span");
    profitVal.className = "aglivre-panel__value aglivre-panel__profit";
    if (profit.positive === true) profitVal.classList.add("aglivre-panel__profit--pos");
    if (profit.positive === false) profitVal.classList.add("aglivre-panel__profit--neg");
    profitVal.textContent = profit.text;
    rowProfit.appendChild(profitVal);
    panel.appendChild(rowProfit);

    // Guarda os dados originais pra recomputar depois do save
    panel._aglivreData = { listingId, cost, vr, title };

    return panel;
  }

  function startEditCost(panel, { listingId, title }) {
    const costEl = panel.querySelector(".aglivre-panel__cost");
    if (!costEl || costEl.dataset.editing === "1") return;
    costEl.dataset.editing = "1";

    const currentText = costEl.textContent;
    const currentVal = panel._aglivreData?.cost;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "aglivre-panel__input";
    input.value = currentVal != null ? currentVal.toFixed(2).replace(".", ",") : "";
    input.placeholder = "0,00";

    costEl.replaceWith(input);
    input.focus();
    input.select();

    const cleanup = () => {
      input.replaceWith(costEl);
      costEl.dataset.editing = "";
      costEl.textContent = currentText;
    };

    const commit = async () => {
      const raw = input.value.trim().replace(/\./g, "").replace(",", ".");
      const value = parseFloat(raw);
      if (!Number.isFinite(value) || value < 0) {
        cleanup();
        return;
      }
      input.disabled = true;
      try {
        await send({
          type: "saveCost",
          mlListingId: listingId,
          productCost: value,
          title: title || null,
        });
        // recria painel com novo custo
        const data = panel._aglivreData;
        data.cost = value;
        const fresh = buildPanel(data);
        panel.replaceWith(fresh);
      } catch (err) {
        console.error("[agLivre] erro ao salvar custo", err);
        cleanup();
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    });
    input.addEventListener("blur", commit, { once: true });
  }

  function insertPanel(card, panel) {
    // Remove versões antigas
    for (const old of card.querySelectorAll("." + MARKER_CLASS)) old.remove();
    card.appendChild(panel);
  }

  let authWarned = false;
  async function process() {
    const cards = findCards();
    LOG("process() →", cards.size, "card(s) encontrado(s)");
    if (cards.size === 0) return;

    const cardArr = [...cards];
    const meta = cardArr
      .map((card) => {
        const listingId = card.getAttribute(PROCESSED_ATTR);
        if (!listingId) return null;
        return {
          card,
          listingId,
          vr: extractVoceRecebe(card),
          title: extractTitle(card),
        };
      })
      .filter(Boolean);

    const listingIds = [...new Set(meta.map((m) => m.listingId))];
    LOG("listingIds extraídos:", listingIds);
    let costs = {};
    try {
      const res = await send({ type: "fetchCosts", listingIds });
      costs = res?.costs || {};
      LOG("custos recebidos:", costs);
      authWarned = false;
    } catch (err) {
      if (err.message === "NOT_AUTHENTICATED") {
        if (!authWarned) {
          WARN("extensão não autenticada — clique no ícone da extensão e faça login");
          authWarned = true;
        }
        return;
      }
      WARN("erro ao buscar custos:", err);
      return;
    }

    for (const { card, listingId, vr, title } of meta) {
      const cost = costs[listingId] ?? null;
      const panel = buildPanel({ listingId, cost, vr, title });
      insertPanel(card, panel);
    }
  }

  const debouncedProcess = debounce(process, 400);

  const observer = new MutationObserver((mutations) => {
    // ignora mutações causadas pelos nossos próprios painéis
    for (const m of mutations) {
      if (m.target && m.target.closest?.("." + MARKER_CLASS)) continue;
      debouncedProcess();
      return;
    }
  });

  function start() {
    LOG("start() — ativando MutationObserver");
    observer.observe(document.body, { childList: true, subtree: true });
    process();
    // Re-tenta algumas vezes (ML carrega a tabela de forma assíncrona)
    setTimeout(process, 1500);
    setTimeout(process, 3500);
    setTimeout(process, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // Debug — no console: window.__aglivreDebug.process()
  window.__aglivreDebug = { process, findCards, extractVoceRecebe };
})();
