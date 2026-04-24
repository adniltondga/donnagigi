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

  // Cache global dos dados do backend: mapa mlListingId →
  //   { listingCost: number|null, variantCosts: {variationId: cost},
  //     variations: {variationId: variationName|null} }
  // Preenchido a cada process() a partir do response de fetchCosts.
  const listingData = new Map();

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

  let contextInvalidated = false;

  const send = (msg) =>
    new Promise((resolve, reject) => {
      if (contextInvalidated) return reject(new Error("EXTENSION_CONTEXT_INVALIDATED"));
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            if (/context invalidated|receiving end does not exist/i.test(err.message || "")) {
              contextInvalidated = true;
            }
            return reject(err);
          }
          if (!res?.ok) return reject(new Error(res?.error || "Erro"));
          resolve(res.data);
        });
      } catch (err) {
        // sendMessage pode throw sync quando o contexto morre
        if (/context invalidated|Extension context/i.test(err?.message || "")) {
          contextInvalidated = true;
        }
        reject(err);
      }
    });

  /**
   * Encontra o container de cada card. Usa "Selecionar anúncio" como
   * âncora (aparece em todo card) e sobe no DOM até o ancestral que
   * contém exatamente UM "#MLBid" — esse é o card.
   */
  function findCards() {
    const cards = new Set();
    const anchors = [];
    // Regex pra bater "MLB123456..." OU "#123456..." (ID do anúncio).
    const ID_RE = /(?:MLB|#)(\d{6,})/i;
    const ID_RE_GLOBAL = /(?:MLB|#)\d{6,}/gi;

    // Estratégia 1: links do anúncio — a[href] contém /MLB-XXXXX
    const mlbLinks = document.querySelectorAll('a[href*="MLB-"], a[href*="/MLB"]');
    for (const a of mlbLinks) anchors.push(a);
    if (mlbLinks.length > 0) LOG("estratégia links a[href*=MLB]:", mlbLinks.length);

    // Estratégia 2: texto "Selecionar anúncio" (singular)
    if (anchors.length === 0) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = (node.nodeValue || "").trim();
        if (t === "Selecionar anúncio") anchors.push(node.parentElement);
      }
      if (anchors.length > 0) LOG("estratégia 'Selecionar anúncio':", anchors.length);
    }

    // Estratégia 3 (fallback amplo): qualquer texto com MLB\d+ ou #\d+ (6+)
    if (anchors.length === 0) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (ID_RE.test(node.nodeValue || "") && node.parentElement) {
          anchors.push(node.parentElement);
        }
      }
      if (anchors.length > 0) LOG("estratégia fallback MLB/#digits:", anchors.length);
    }

    if (anchors.length === 0) {
      WARN("nenhuma âncora de card encontrada — o ML pode ter mudado a estrutura");
    }

    for (const anchor of anchors) {
      let cur = anchor;
      let last = null;
      while (cur && cur !== document.body) {
        const txt = cur.textContent || "";
        const ids = txt.match(ID_RE_GLOBAL);
        if (ids && ids.length === 1) {
          last = cur;
        } else if (ids && ids.length > 1) {
          break;
        }
        cur = cur.parentElement;
      }
      if (last) {
        const m = ID_RE.exec(last.textContent || "");
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
  /**
   * Extrai "Você recebe" do card. Prioriza a célula com classe
   * `--earnings` (padrão andes do ML). Fallback: varre text nodes.
   */
  function extractVoceRecebe(card) {
    // Normaliza espaços (inclusive &nbsp; U+00A0) antes de aplicar regex.
    const norm = (s) => String(s).replace(/[ \s]+/g, " ").trim();
    const parseRange = (raw) => {
      const s = norm(raw);
      // Faixa: "R$ 24,65 a R$ 28,57"
      const m = s.match(/R\$\s*([\d.,]+)\s*(?:a|–|-|até)\s*R\$\s*([\d.,]+)/i);
      if (m) {
        const a = parsePrice(m[1]);
        const b = parsePrice(m[2]);
        if (Number.isFinite(a) && Number.isFinite(b)) return { min: a, max: b };
      }
      // Valor único: "R$ 40,94"
      const single = s.match(/R\$\s*([\d.,]+)/);
      if (single) {
        const v = parsePrice(single[1]);
        if (Number.isFinite(v)) return { min: v, max: null };
      }
      return null;
    };

    // Nas rows, a cell é .sll-list-cell-earnings (sem duplo-hífen, diferente
    // do header). O valor "R$ 40,94" fica dentro de .sll-list-text-line.
    const earningsCell = card.querySelector(".sll-list-cell-earnings");
    if (earningsCell) {
      // Só pegamos o texto das "linhas" visíveis — evita conteúdo escondido
      // de tooltips (andes-visually-hidden) que tem outros R$ parasitas.
      const lines = earningsCell.querySelectorAll(".sll-list-text-line");
      for (const line of lines) {
        const r = parseRange(line.textContent || "");
        if (r) return r;
      }
      // Fallback: text content da cell inteira (filtrado)
      const r = parseRange(earningsCell.textContent || "");
      if (r) return r;
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

  /* =========================================================
   * Injeção de colunas reais no grid sll-list-* do ML.
   * Alternativa ao painel "flutuante" no final do card.
   * =======================================================*/

  const COL_COST_CLS = "aglivre-col--cost";
  const COL_PROFIT_CLS = "aglivre-col--profit";
  const HEADER_INJECTED_ATTR = "data-aglivre-columns";

  /**
   * O ML usa CSS Grid com variáveis custom definidas inline no .sll-list-grid:
   *   --grid-structure: "254px 114px 109px 123px 80px 74px 74px 240px"  (8 cols)
   *   --row-content-structure: "114px 109px 123px 80px 74px 74px 240px"  (7 cols)
   *
   * Precisamos inserir "80px 80px" em 2 posições:
   *  • --grid-structure após a 4ª coluna (earnings = index 3)
   *  • --row-content-structure após a 3ª coluna (earnings = index 2, sem produto)
   */
  function expandGridStructure() {
    const grid = document.querySelector(".sll-list-grid");
    if (!grid) return;
    if (grid.dataset.aglivreGridExpanded === "1") return;

    const insertCols = (value, afterIndex) => {
      if (!value) return null;
      const parts = value.trim().split(/\s+/);
      if (parts.length <= afterIndex) return null;
      const before = parts.slice(0, afterIndex + 1);
      const after = parts.slice(afterIndex + 1);
      return [...before, "80px", "80px", ...after].join(" ");
    };

    const style = grid.style;
    const gs = style.getPropertyValue("--grid-structure");
    const rcs = style.getPropertyValue("--row-content-structure");

    const newGs = insertCols(gs, 3); // depois de "Você recebe" no header
    const newRcs = insertCols(rcs, 2); // depois de "Você recebe" na row

    if (newGs) style.setProperty("--grid-structure", newGs);
    if (newRcs) style.setProperty("--row-content-structure", newRcs);
    grid.dataset.aglivreGridExpanded = "1";
    LOG("grid expandido:", { "--grid-structure": newGs, "--row-content-structure": newRcs });
  }

  /**
   * Garante que os 2 headers (Custo/Lucro) estão no grid do header.
   * Retorna true se conseguiu localizar a estrutura.
   */
  function ensureHeaderColumns() {
    const earnings = document.querySelector(".sll-list-header-cell--earnings");
    if (!earnings) return false;
    const headerRow = earnings.parentElement;
    if (!headerRow) return false;

    expandGridStructure();

    if (headerRow.getAttribute(HEADER_INJECTED_ATTR) === "1") return true;

    const mk = (label, modClass) => {
      const cell = document.createElement("div");
      cell.className = `sll-list-header-cell aglivre-col ${modClass}--header`;
      const span = document.createElement("span");
      span.className =
        "andes-typography sll-list-header-cell__label andes-typography--type-body andes-typography--size-s andes-typography--color-primary andes-typography--weight-semibold";
      span.textContent = label;
      cell.appendChild(span);
      return cell;
    };

    earnings.after(mk("Custo", COL_COST_CLS), mk("Lucro", COL_PROFIT_CLS));
    headerRow.setAttribute(HEADER_INJECTED_ATTR, "1");
    LOG("colunas de header injetadas");
    return true;
  }

  /**
   * Localiza a célula "Você recebe" dentro de uma row de dados.
   * Nas rows a classe correta é `sll-list-cell-earnings` (sem duplo-hífen,
   * diferente do header que usa `--earnings`).
   * A célula vive dentro de `.sll-list-grid-row__structure-cell-columns`.
   */
  function findRowEarningsCell(card) {
    const cell = card.querySelector(".sll-list-cell-earnings");
    if (!cell) return null;
    const parent = cell.closest(".sll-list-grid-row__structure-cell-columns");
    if (!parent) return { cell, parent: cell.parentElement };
    return { cell, parent };
  }

  /**
   * Pra cada card (row), acha a célula "Você recebe" e insere 2 cells
   * depois dela. Retorna true se injetou.
   */
  function injectRowColumns(card, { listingId, cost, vr, title }) {
    const found = findRowEarningsCell(card);
    if (!found) {
      if (!card._aglivreLoggedFail) {
        LOG("row earnings não achado no card", card, "→ cai no fallback painel");
        card._aglivreLoggedFail = true;
      }
      return false;
    }
    const { cell: earningsCell, parent: rowParent } = found;
    if (!earningsCell || !rowParent) return false;

    // Se já tem as cells no card, atualiza conteúdo em vez de recriar
    let costCell = card.querySelector("." + COL_COST_CLS);
    let profitCell = card.querySelector("." + COL_PROFIT_CLS);
    if (!costCell || !profitCell) {
      if (costCell) costCell.remove();
      if (profitCell) profitCell.remove();
      costCell = document.createElement("div");
      costCell.className = `aglivre-col ${COL_COST_CLS}`;
      profitCell = document.createElement("div");
      profitCell.className = `aglivre-col ${COL_PROFIT_CLS}`;
      earningsCell.after(costCell, profitCell);
    }

    renderCostCell(costCell, { listingId, cost, title });
    renderProfitCell(profitCell, { cost, vr });
    return true;
  }

  function renderCostCell(cell, { listingId, cost, title }) {
    cell.innerHTML = "";
    cell._aglivreData = { listingId, cost, title };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "aglivre-cell-value aglivre-cell-cost";
    btn.title = "Clique pra editar custo";
    if (cost == null) {
      btn.textContent = "Definir";
      btn.classList.add("aglivre-cell-value--empty");
    } else {
      btn.textContent = fmt(cost);
    }
    btn.addEventListener("click", () => startEditCellCost(cell));
    cell.appendChild(btn);
  }

  function renderProfitCell(cell, { cost, vr }) {
    cell.innerHTML = "";
    const span = document.createElement("span");
    span.className = "aglivre-cell-value aglivre-cell-profit";
    const p = computeProfit(cost, vr);
    if (p.positive === true) span.classList.add("aglivre-cell-profit--pos");
    if (p.positive === false) span.classList.add("aglivre-cell-profit--neg");
    span.textContent = p.text;
    cell.appendChild(span);
  }

  function startEditCellCost(cell) {
    const data = cell._aglivreData;
    if (!data) return;
    const btn = cell.querySelector(".aglivre-cell-cost");
    if (!btn || btn.dataset.editing === "1") return;

    // Decisão: se o listing tem variações conhecidas (cadastradas ou vendidas),
    // abre o modal com lista. Senão, input inline (fluxo simples).
    const info = listingData.get(data.listingId);
    const hasVariations =
      info && info.variations && Object.keys(info.variations).length > 0;

    if (hasVariations) {
      openCostModal({
        listingId: data.listingId,
        title: data.title || null,
        info,
      });
      return;
    }

    // Fluxo inline (anúncio sem variações conhecidas)
    btn.dataset.editing = "1";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "aglivre-cell-input";
    input.value = data.cost != null ? data.cost.toFixed(2).replace(".", ",") : "";
    input.placeholder = "0,00";
    btn.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      input.replaceWith(btn);
      btn.dataset.editing = "";
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
          payload: {
            mlListingId: data.listingId,
            productCost: value,
            title: data.title || null,
          },
        });
        settled = true;
        // Atualiza cache local
        const cached = listingData.get(data.listingId) || {
          listingCost: null,
          variantCosts: {},
          variations: {},
        };
        cached.listingCost = value;
        listingData.set(data.listingId, cached);
        updateCardAfterSave(cell, data, value);
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

  /**
   * Depois de salvar o custo (inline ou modal), re-renderiza as células
   * Custo/Lucro do card. Pra variações, mostramos o custo GERAL como
   * referência visual (o resolver vai aplicar o específico no backend
   * quando a venda vier com variation_id).
   */
  function updateCardAfterSave(cell, data, value) {
    const card = cell.closest("[" + PROCESSED_ATTR + "]");
    if (!card) return;
    const vr = extractVoceRecebe(card);
    renderCostCell(cell, { listingId: data.listingId, cost: value, title: data.title });
    const profitCell = card.querySelector("." + COL_PROFIT_CLS);
    if (profitCell) renderProfitCell(profitCell, { cost: value, vr });
    card.dataset.aglivreSig = `${data.listingId}|${value}|${vr ? `${vr.min}-${vr.max ?? ""}` : "-"}`;
  }

  /**
   * Modal pra editar custo geral do listing + custo específico por variação.
   */
  function openCostModal({ listingId, title, info }) {
    // Remove modal anterior se estiver aberto
    document.querySelector(".aglivre-modal-backdrop")?.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "aglivre-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "aglivre-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const close = () => backdrop.remove();
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener(
      "keydown",
      function onKey(e) {
        if (e.key === "Escape") {
          close();
          document.removeEventListener("keydown", onKey);
        }
      },
      { once: true }
    );

    const header = document.createElement("div");
    header.className = "aglivre-modal__header";
    header.innerHTML = `
      <div>
        <div class="aglivre-modal__badge">agLivre</div>
        <h2 class="aglivre-modal__title">Editar custos</h2>
        <p class="aglivre-modal__sub">${listingId}${title ? " · " + escapeHtml(title.slice(0, 60)) : ""}</p>
      </div>
      <button type="button" class="aglivre-modal__close" aria-label="Fechar">×</button>
    `;
    header.querySelector(".aglivre-modal__close").addEventListener("click", close);
    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "aglivre-modal__body";

    // Custo geral (fallback)
    const listingRow = buildCostRow({
      label: "Custo geral (padrão)",
      hint: "Usado quando a variação não tem custo próprio.",
      initial: info.listingCost,
      placeholder: "0,00",
    });
    body.appendChild(listingRow.el);

    // Separador
    const sep = document.createElement("div");
    sep.className = "aglivre-modal__sep";
    sep.innerHTML = `<span>Variações</span>`;
    body.appendChild(sep);

    // Uma linha por variação conhecida
    const variationRows = [];
    const variationEntries = Object.entries(info.variations || {});
    if (variationEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "aglivre-modal__empty";
      empty.textContent = "Nenhuma variação detectada ainda. Elas aparecem conforme você vende.";
      body.appendChild(empty);
    }
    for (const [vid, vname] of variationEntries) {
      const vcost = info.variantCosts[vid];
      const row = buildCostRow({
        label: vname || "Variação",
        hint: vid,
        initial: vcost != null ? vcost : null,
        placeholder:
          info.listingCost != null
            ? info.listingCost.toFixed(2).replace(".", ",")
            : "0,00",
      });
      variationRows.push({ variationId: vid, variationName: vname, ...row });
      body.appendChild(row.el);
    }

    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "aglivre-modal__footer";
    const err = document.createElement("span");
    err.className = "aglivre-modal__error";
    footer.appendChild(err);
    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "aglivre-modal__btn aglivre-modal__btn--ghost";
    btnCancel.textContent = "Cancelar";
    btnCancel.addEventListener("click", close);
    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "aglivre-modal__btn aglivre-modal__btn--primary";
    btnSave.textContent = "Salvar tudo";
    footer.appendChild(btnCancel);
    footer.appendChild(btnSave);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    setTimeout(() => listingRow.input.focus(), 50);

    btnSave.addEventListener("click", async () => {
      err.textContent = "";
      const toSave = [];

      // Listing cost (se mudou)
      const newListing = parseCostInput(listingRow.input.value);
      if (newListing.invalid) {
        err.textContent = "Custo geral inválido";
        return;
      }
      if (
        newListing.value != null &&
        (info.listingCost == null || Math.abs(newListing.value - info.listingCost) > 0.001)
      ) {
        toSave.push({
          mlListingId: listingId,
          title,
          productCost: newListing.value,
        });
      }

      // Variações (só as que mudaram)
      for (const r of variationRows) {
        const parsed = parseCostInput(r.input.value);
        if (parsed.invalid) {
          err.textContent = `Custo inválido em: ${r.variationName || r.variationId}`;
          return;
        }
        const cur = info.variantCosts[r.variationId];
        if (parsed.value == null) continue; // vazio = usa o geral (não salva)
        if (cur == null || Math.abs(parsed.value - cur) > 0.001) {
          toSave.push({
            mlListingId: listingId,
            variationId: r.variationId,
            variationName: r.variationName,
            productCost: parsed.value,
          });
        }
      }

      if (toSave.length === 0) {
        close();
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = "Salvando…";
      try {
        for (const p of toSave) {
          await send({ type: "saveCost", payload: p });
        }
        // Atualiza cache global
        const cached = listingData.get(listingId) || {
          listingCost: null,
          variantCosts: {},
          variations: info.variations,
        };
        if (newListing.value != null) cached.listingCost = newListing.value;
        for (const r of variationRows) {
          const parsed = parseCostInput(r.input.value);
          if (parsed.value != null) cached.variantCosts[r.variationId] = parsed.value;
        }
        listingData.set(listingId, cached);

        // Re-renderiza células do card com o novo custo geral
        const displayCost = cached.listingCost;
        const card = document.querySelector(
          `[${PROCESSED_ATTR}="${listingId}"]`
        );
        if (card) {
          const costCell = card.querySelector("." + COL_COST_CLS);
          if (costCell) {
            const data = costCell._aglivreData || { listingId, title, cost: displayCost };
            updateCardAfterSave(costCell, data, displayCost);
          }
        }
        close();
      } catch (e) {
        err.textContent = "Erro ao salvar: " + (e?.message || e);
        btnSave.disabled = false;
        btnSave.textContent = "Salvar tudo";
      }
    });
  }

  function buildCostRow({ label, hint, initial, placeholder }) {
    const el = document.createElement("label");
    el.className = "aglivre-modal__row";
    const left = document.createElement("div");
    left.className = "aglivre-modal__row-left";
    const lab = document.createElement("div");
    lab.className = "aglivre-modal__row-label";
    lab.textContent = label;
    const hn = document.createElement("div");
    hn.className = "aglivre-modal__row-hint";
    hn.textContent = hint || "";
    left.appendChild(lab);
    if (hint) left.appendChild(hn);
    el.appendChild(left);

    const wrap = document.createElement("div");
    wrap.className = "aglivre-modal__row-input";
    const prefix = document.createElement("span");
    prefix.textContent = "R$";
    wrap.appendChild(prefix);
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.placeholder = placeholder || "0,00";
    if (initial != null) input.value = Number(initial).toFixed(2).replace(".", ",");
    wrap.appendChild(input);
    el.appendChild(wrap);

    return { el, input };
  }

  function parseCostInput(raw) {
    const s = String(raw || "").trim();
    if (!s) return { value: null, invalid: false };
    const num = parseFloat(s.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(num) || num < 0) return { value: null, invalid: true };
    return { value: num, invalid: false };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  /**
   * Insere o painel num lugar visível do card. Se o card for <tr>, não dá
   * pra colocar <div> direto — põe dentro do último <td>. Se for grid/flex
   * row em <div>, appendChild funciona. Também tenta colocar próximo à
   * coluna "Você recebe" se existir.
   */
  function insertPanel(card, panel) {
    // Remove versões antigas
    for (const old of card.querySelectorAll("." + MARKER_CLASS)) old.remove();

    const tag = card.tagName?.toLowerCase();
    if (tag === "tr") {
      const lastTd = card.querySelector("td:last-child");
      if (lastTd) {
        lastTd.appendChild(panel);
        return;
      }
    }
    card.appendChild(panel);
  }

  /**
   * Cria um marcador de versão do painel. Se mesmo listingId + cost + vr,
   * pula re-render (evita loop infinito com o MutationObserver).
   */
  function panelSignature({ listingId, cost, vr }) {
    const vrKey = vr ? `${vr.min}-${vr.max ?? ""}` : "-";
    return `${listingId}|${cost ?? ""}|${vrKey}`;
  }

  let authWarned = false;
  let processing = false;
  let pausedObserver = false;

  async function process() {
    if (contextInvalidated || processing) return;
    processing = true;
    try {
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
      let variantCosts = {};
      let variations = {};
      try {
        const res = await send({ type: "fetchCosts", listingIds });
        costs = res?.costs || {};
        variantCosts = res?.variantCosts || {};
        variations = res?.variations || {};
        LOG("custos recebidos:", { costs, variantCosts, variations });
        // Atualiza cache global por listing
        for (const lid of listingIds) {
          listingData.set(lid, {
            listingCost: costs[lid] ?? null,
            variantCosts: variantCosts[lid] || {},
            variations: variations[lid] || {},
          });
        }
        authWarned = false;
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg === "NOT_AUTHENTICATED") {
          if (!authWarned) {
            WARN("extensão não autenticada — clique no ícone da extensão e faça login");
            authWarned = true;
          }
          return;
        }
        if (contextInvalidated || /context invalidated|receiving end does not exist/i.test(msg)) {
          WARN("extensão foi recarregada — recarregue essa aba (Ctrl+Shift+R) pra continuar");
          observer.disconnect();
          return;
        }
        WARN("erro ao buscar custos:", msg);
        return;
      }

      pausedObserver = true;
      try {
        ensureHeaderColumns();
        for (const { card, listingId, vr, title } of meta) {
          const cost = costs[listingId] ?? null;
          const sig = panelSignature({ listingId, cost, vr });
          // Remove painéis flutuantes antigos (versões anteriores da extensão)
          for (const old of card.querySelectorAll("." + MARKER_CLASS)) old.remove();
          // Se já renderizou com a mesma assinatura + tem cells injetadas, pula.
          if (card.dataset.aglivreSig === sig && card.querySelector("." + COL_COST_CLS)) {
            continue;
          }
          injectRowColumns(card, { listingId, cost, vr, title });
          card.dataset.aglivreSig = sig;
        }
      } finally {
        // Deixa o DOM assentar antes de reativar o observer.
        setTimeout(() => {
          pausedObserver = false;
        }, 100);
      }
    } finally {
      processing = false;
    }
  }

  const debouncedProcess = debounce(process, 600);

  const observer = new MutationObserver((mutations) => {
    if (pausedObserver) return;
    // Ignora mutações causadas pelos nossos próprios painéis
    let relevant = false;
    for (const m of mutations) {
      const target = m.target;
      if (!target) continue;
      if (target.nodeType === 1 && target.closest && target.closest("." + MARKER_CLASS)) continue;
      // Verifica se todos os addedNodes são nossos painéis
      const added = m.addedNodes ? Array.from(m.addedNodes) : [];
      const allOurs =
        added.length > 0 &&
        added.every(
          (n) => n.nodeType === 1 && n.classList && n.classList.contains(MARKER_CLASS)
        );
      if (allOurs) continue;
      relevant = true;
      break;
    }
    if (relevant) debouncedProcess();
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

  // Debug — no console: window.__aglivreDebug.process() / .scan()
  window.__aglivreDebug = {
    process,
    findCards,
    extractVoceRecebe,
    scan() {
      const mlbInText = (document.body.textContent || "").match(/MLB\d{6,}/gi) || [];
      const hashInText = (document.body.textContent || "").match(/#\d{6,}/g) || [];
      const mlbLinks = document.querySelectorAll('a[href*="MLB"]');
      const iframes = document.querySelectorAll("iframe");
      const shadowHosts = Array.from(document.querySelectorAll("*")).filter((el) => el.shadowRoot);
      return {
        url: location.href,
        mlbMatchesInBody: mlbInText.length,
        mlbSamples: mlbInText.slice(0, 5),
        hashMatchesInBody: hashInText.length,
        hashSamples: hashInText.slice(0, 5),
        linksWithMLB: mlbLinks.length,
        firstLinkSample: mlbLinks[0]?.href || null,
        iframes: iframes.length,
        shadowRoots: shadowHosts.length,
        bodyLen: document.body.innerHTML.length,
      };
    },
  };
})();
