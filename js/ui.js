/**
 * @fileoverview UI — рендеринг для всіх 5 методів задачі «Рюкзак»
 * @module ui
 */
"use strict";

/* ══════════════════════════════════════════════════════
   БАЗОВІ UI-УТИЛІТИ
══════════════════════════════════════════════════════ */

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearHighlights() {
  document.querySelectorAll(".active-cell").forEach(c => c.classList.remove("active-cell"));
}

function resetResults() {
  ["res-value","res-items","res-weight","res-total"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "—";
  });
  const extra = document.getElementById("res-extra");
  if (extra) extra.innerHTML = "";
}

function resetUI() {
  resetResults();
  document.querySelectorAll(".item-card.selected-item").forEach(c => c.classList.remove("selected-item"));
  document.getElementById("table-wrapper").innerHTML =
    `<p class="empty-hint">Таблицю скинуто. Оберіть предмети та запустіть нове моделювання…</p>`;
  setStatus("↺ Скинуто. Оберіть предмети та натисніть кнопку.");
  const steps = document.getElementById("steps-log");
  if (steps) steps.innerHTML = "";
}

/* ══════════════════════════════════════════════════════
   VARIANT INFO + КАРТКИ ПРЕДМЕТІВ
══════════════════════════════════════════════════════ */

function renderVariantInfo(data, items, checkedIds) {
  const info = document.getElementById("variant-info");
  info.innerHTML = `
    <p><strong>Варіант:</strong> ${data.variant}</p>
    <p><strong>Всього предметів (n):</strong> ${data.itemCount}</p>
    <p><strong>Ваги w[i]:</strong> [${data.weights.join(", ")}]</p>
    <p><strong>Цінності v[i]:</strong> [${data.values.join(", ")}]</p>
  `;
  renderItemCards(items, checkedIds);
}

function renderItemCards(items, checkedIds) {
  const list = document.getElementById("items-list");
  list.innerHTML = items.map(item => {
    const checked = checkedIds.has(item.id) ? "checked" : "";
    return `
      <div class="item-card ${checked}" id="item-${item.id}" onclick="toggleItem(${item.id})">
        <strong>Предмет ${item.id}</strong><br>
        вага = ${item.weight} &nbsp;|&nbsp; цінність = ${item.value}
      </div>`;
  }).join("");
  updateSelectionSummary(items, checkedIds);
}

function updateSelectionSummary(items, checkedIds) {
  const el  = document.getElementById("selection-summary");
  const sel = items.filter(i => checkedIds.has(i.id));
  const totalW = sel.reduce((s, i) => s + i.weight, 0);
  const totalV = sel.reduce((s, i) => s + i.value,  0);
  if (sel.length === 0) {
    el.textContent = "⚠ Не вибрано жодного предмета.";
    el.className = "selection-summary warn";
  } else {
    el.textContent = `Вибрано предметів: ${sel.length} | Загальна вага: ${totalW} | Загальна цінність: ${totalV}`;
    el.className = "selection-summary";
  }
}

/* ══════════════════════════════════════════════════════
   ТАБЛИЦЯ ДП (Метод 4)
══════════════════════════════════════════════════════ */

function renderEmptyTable(items, capacity) {
  const wrapper = document.getElementById("table-wrapper");
  let html = `<table id="dp-table"><thead><tr><th style="min-width:110px">i \\ w</th>`;
  for (let w = 0; w <= capacity; w++) html += `<th>${w}</th>`;
  html += `</tr></thead><tbody>`;
  html += `<tr><td class="row-header">0 (∅)</td>`;
  for (let w = 0; w <= capacity; w++) html += `<td id="cell-0-${w}">0</td>`;
  html += `</tr>`;
  for (let i = 1; i <= items.length; i++) {
    const item = items[i - 1];
    html += `<tr><td class="row-header" title="Предмет ${item.id}: вага=${item.weight}, цінність=${item.value}">
      ${i}. П.${item.id} (w=${item.weight}, v=${item.value})</td>`;
    for (let w = 0; w <= capacity; w++) html += `<td id="cell-${i}-${w}"></td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

function fillTableImmediately(dp, items, capacity) {
  renderEmptyTable(items, capacity);
  for (let i = 1; i <= items.length; i++)
    for (let w = 0; w <= capacity; w++) {
      const cell = document.getElementById(`cell-${i}-${w}`);
      if (cell) cell.textContent = dp[i][w];
    }
}

async function fillTableStepByStep(steps, delay = 120) {
  clearHighlights();
  for (const step of steps) {
    const cell = document.getElementById(`cell-${step.i}-${step.w}`);
    if (!cell) continue;
    clearHighlights();
    cell.classList.add("active-cell");
    cell.textContent = step.value;
    setStatus(`Крок [${step.i}][${step.w}]: ${step.decision}`);
    appendStepLog(`[i=${step.i}, w=${step.w}] → ${step.value} | ${step.decision}`);
    await sleep(delay);
  }
  clearHighlights();
  setStatus("✅ Таблицю dp побудовано. Натисніть «Відновити розв'язок».");
}

function highlightSolutionPath(path, selectedItems, allItems) {
  path.forEach(({ i, w }) => {
    const cell = document.getElementById(`cell-${i}-${w}`);
    if (cell) cell.classList.add("path-cell");
  });
  selectedItems.forEach(item => {
    const card = document.getElementById(`item-${item.id}`);
    if (card) card.classList.add("selected-item");
  });
}

/* ══════════════════════════════════════════════════════
   ВІЗУАЛІЗАЦІЯ МЕТОДУ 1 — ГРУБА СИЛА
══════════════════════════════════════════════════════ */

function renderBruteForceTable(steps, items, capacity) {
  const wrapper = document.getElementById("table-wrapper");
  const n = items.length;
  const maxShow = Math.min(steps.length, 256); // Показуємо до 256 рядків

  let html = `
    <div class="method-info-box">
      <strong>Груба сила:</strong> перебираємо всі 2<sup>${n}</sup> = ${1 << n} підмножин.
      ${steps.length > 256 ? `<br><span class="warn-text">⚠ Показано перші 256 з ${steps.length} підмножин.</span>` : ""}
    </div>
    <table id="bf-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Маска (бінарна)</th>
          <th>Предмети</th>
          <th>Вага</th>
          <th>Цінність</th>
          <th>Влізає?</th>
          <th>Найкращий?</th>
        </tr>
      </thead>
      <tbody>`;

  for (let k = 0; k < maxShow; k++) {
    const s = steps[k];
    const rowClass = s.isBest ? "bf-best-row" : (s.feasible ? "bf-ok-row" : "bf-bad-row");
    html += `
      <tr class="${rowClass}">
        <td>${s.mask}</td>
        <td class="mono">${s.binaryMask}</td>
        <td>${s.subset.length ? s.subset.map(id=>`П.${id}`).join(", ") : "∅"}</td>
        <td>${s.totalW}</td>
        <td>${s.totalV}</td>
        <td>${s.feasible ? "✔" : `✘ (>${capacity})`}</td>
        <td>${s.isBest ? "⭐ Так" : ""}</td>
      </tr>`;
  }
  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function renderBruteForceStepByStep(steps, items, capacity, delay) {
  const wrapper = document.getElementById("table-wrapper");
  const n = items.length;

  wrapper.innerHTML = `
    <div class="method-info-box">
      <strong>Груба сила:</strong> перебираємо всі 2<sup>${n}</sup> = ${1 << n} підмножин покроково.
    </div>
    <table id="bf-table">
      <thead>
        <tr>
          <th>#</th><th>Маска</th><th>Предмети</th>
          <th>Вага</th><th>Цінність</th><th>Влізає?</th><th>Найкращий?</th>
        </tr>
      </thead>
      <tbody id="bf-tbody"></tbody>
    </table>`;

  const tbody = document.getElementById("bf-tbody");
  let bestValue = 0;

  for (const s of steps) {
    if (s.isBest) bestValue = s.totalV;
    const rowClass = s.isBest ? "bf-best-row" : (s.feasible ? "bf-ok-row" : "bf-bad-row");
    const tr = document.createElement("tr");
    tr.className = rowClass + " anim-row";
    tr.innerHTML = `
      <td>${s.mask}</td>
      <td class="mono">${s.binaryMask}</td>
      <td>${s.subset.length ? s.subset.map(id=>`П.${id}`).join(", ") : "∅"}</td>
      <td>${s.totalW}</td>
      <td>${s.totalV}</td>
      <td>${s.feasible ? "✔" : `✘ (>${capacity})`}</td>
      <td>${s.isBest ? "⭐" : ""}</td>`;
    tbody.appendChild(tr);
    tbody.scrollTop = tbody.scrollHeight;

    setStatus(`Підмножина ${s.mask}: [${s.subset.map(id=>`П.${id}`).join(",")||"∅"}] вага=${s.totalW} цінність=${s.totalV} ${s.feasible ? (s.isBest ? "⭐ НОВИЙ КРАЩИЙ!" : "✔") : "✘"}`);
    appendStepLog(`Маска ${s.binaryMask}: предмети=[${s.subset.map(id=>`П.${id}`).join(",")||"∅"}], вага=${s.totalW}, цінність=${s.totalV}${s.isBest?" ← КРАЩИЙ":""}`);
    await sleep(delay);
  }
}

/* ══════════════════════════════════════════════════════
   ВІЗУАЛІЗАЦІЯ МЕТОДУ 2 — МЕМОІЗАЦІЯ
══════════════════════════════════════════════════════ */

function renderMemoTable(steps, items, capacity) {
  const wrapper = document.getElementById("table-wrapper");

  // Будуємо матрицю викликів
  const n = items.length;
  const grid = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(null));
  for (const s of steps) {
    if (!s.cached && s.i !== undefined) grid[s.i][s.w] = s.value;
  }

  let html = `
    <div class="method-info-box">
      <strong>Рекурсія з мемоізацією (Top-Down):</strong> обчислюємо тільки необхідні підзадачі.<br>
      Кешовано: ${steps.filter(s=>s.cached).length} | Обчислено: ${steps.filter(s=>!s.cached).length}
    </div>
    <table id="memo-table">
      <thead>
        <tr><th>i \\ w</th>`;
  for (let w = 0; w <= capacity; w++) html += `<th>${w}</th>`;
  html += `</tr></thead><tbody>`;

  for (let i = 0; i <= n; i++) {
    const label = i === 0 ? "0 (∅)" : `${i}. П.${items[i-1].id}`;
    html += `<tr><td class="row-header">${label}</td>`;
    for (let w = 0; w <= capacity; w++) {
      const val = grid[i][w];
      const cls = val !== null ? "memo-computed" : "memo-empty";
      html += `<td class="${cls}">${val !== null ? val : "·"}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function renderMemoStepByStep(steps, items, capacity, delay) {
  // Показуємо таблицю мемо, заповнюємо поступово
  const wrapper = document.getElementById("table-wrapper");
  const n = items.length;

  let html = `
    <div class="method-info-box">
      <strong>Рекурсія з мемоізацією:</strong> покрокове заповнення кешу.
    </div>
    <table id="memo-table">
      <thead><tr><th>i \\ w</th>`;
  for (let w = 0; w <= capacity; w++) html += `<th>${w}</th>`;
  html += `</tr></thead><tbody>`;
  for (let i = 0; i <= n; i++) {
    const label = i === 0 ? "0 (∅)" : `${i}. П.${items[i-1].id}`;
    html += `<tr><td class="row-header">${label}</td>`;
    for (let w = 0; w <= capacity; w++) html += `<td id="mcell-${i}-${w}" class="memo-empty">·</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  wrapper.innerHTML = html;

  for (const s of steps) {
    if (s.i === undefined) continue;
    const cell = document.getElementById(`mcell-${s.i}-${s.w}`);
    if (!cell) continue;
    clearHighlights();
    cell.classList.add("active-cell");
    if (s.cached) {
      cell.classList.add("memo-cached");
      setStatus(`🔁 Кеш [${s.i}][${s.w}] = ${s.value}`);
    } else {
      cell.classList.add("memo-computed");
      cell.textContent = s.value;
      setStatus(`🧮 Обчислено [${s.i}][${s.w}] = ${s.value} | ${s.decision || ""}`);
    }
    appendStepLog(`[${s.i}][${s.w}] = ${s.value}${s.cached ? " (з кешу)" : ""} | ${s.decision || ""}`);
    await sleep(delay);
  }
  clearHighlights();
}

/* ══════════════════════════════════════════════════════
   ВІЗУАЛІЗАЦІЯ МЕТОДУ 3 — ЖАДІБНИЙ
══════════════════════════════════════════════════════ */

function renderGreedyTable(steps, result) {
  const wrapper = document.getElementById("table-wrapper");
  const ei = result.extraInfo;

  let html = `
    <div class="method-info-box">
      <strong>Жадібний алгоритм:</strong> сортуємо за питомою цінністю v/w (спадання).<br>
      Порядок: ${ei.sortedOrder}<br>
      ${ei.isOptimal
        ? `<span class="ok-text">✔ Результат співпадає з оптимумом ДП (${ei.dpOptimal})!</span>`
        : `<span class="warn-text">⚠ Результат (${result.maxValue}) < оптимум ДП (${ei.dpOptimal}). Різниця: ${ei.gap}.</span>`}
    </div>
    <table id="greedy-table">
      <thead>
        <tr>
          <th>Крок</th>
          <th>Предмет</th>
          <th>Вага</th>
          <th>Цінність</th>
          <th>v/w</th>
          <th>Залишок W</th>
          <th>Рішення</th>
        </tr>
      </thead>
      <tbody>`;

  steps.forEach((s, idx) => {
    const rowClass = s.fits ? "bf-ok-row" : "bf-bad-row";
    html += `
      <tr class="${rowClass}">
        <td>${idx + 1}</td>
        <td>П.${s.itemId}</td>
        <td>${s.weight}</td>
        <td>${s.value}</td>
        <td>${s.ratio}</td>
        <td>${s.remaining}</td>
        <td>${s.decision}</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function renderGreedyStepByStep(steps, result, delay) {
  const wrapper = document.getElementById("table-wrapper");
  const ei = result.extraInfo;

  wrapper.innerHTML = `
    <div class="method-info-box">
      <strong>Жадібний алгоритм:</strong> покрокове додавання предметів.<br>
      Порядок сортування: ${ei.sortedOrder}
    </div>
    <table id="greedy-table">
      <thead>
        <tr><th>Крок</th><th>Предмет</th><th>Вага</th><th>Цінність</th>
          <th>v/w</th><th>Залишок W</th><th>Рішення</th></tr>
      </thead>
      <tbody id="greedy-tbody"></tbody>
    </table>`;

  const tbody = document.getElementById("greedy-tbody");

  for (let idx = 0; idx < steps.length; idx++) {
    const s = steps[idx];
    const rowClass = s.fits ? "bf-ok-row anim-row" : "bf-bad-row anim-row";
    const tr = document.createElement("tr");
    tr.className = rowClass;
    tr.innerHTML = `
      <td>${idx + 1}</td><td>П.${s.itemId}</td><td>${s.weight}</td>
      <td>${s.value}</td><td>${s.ratio}</td>
      <td>${s.remaining}</td><td>${s.decision}</td>`;
    tbody.appendChild(tr);
    setStatus(`Крок ${idx+1}: ${s.decision}`);
    appendStepLog(s.decision);
    await sleep(delay);
  }

  if (!ei.isOptimal) {
    setStatus(`⚠ Жадібний дав ${result.maxValue}, оптимум ДП = ${ei.dpOptimal} (різниця ${ei.gap})`);
  }
}

/* ══════════════════════════════════════════════════════
   ВІЗУАЛІЗАЦІЯ МЕТОДУ 5 — ГІЛКИ І МЕЖІ
══════════════════════════════════════════════════════ */

function renderBranchBoundTable(steps, result) {
  const wrapper = document.getElementById("table-wrapper");
  const ei = result.extraInfo;
  const maxShow = Math.min(steps.length, 300);

  let html = `
    <div class="method-info-box">
      <strong>Гілки і межі (Branch & Bound):</strong><br>
      Вузлів розглянуто: ${ei.nodeCount} | Відсічено: ${ei.pruned} | Ефективність: ${ei.efficiency}
    </div>
    <table id="bb-table">
      <thead>
        <tr><th>#</th><th>Тип</th><th>Предмет</th><th>Вага</th><th>Цінність</th><th>Верх. межа</th><th>Відсічено?</th></tr>
      </thead>
      <tbody>`;

  let nodeIdx = 0;
  for (let k = 0; k < maxShow; k++) {
    const s = steps[k];
    if (s.type === "newBest") {
      html += `<tr class="bb-best-row"><td colspan="7">⭐ Новий кращий результат: ${s.value} (предмети: ${s.items})</td></tr>`;
    } else {
      nodeIdx++;
      const cls = s.pruned ? "bf-bad-row" : (s.take ? "bf-ok-row" : "");
      html += `<tr class="${cls}">
        <td>${nodeIdx}</td>
        <td>${s.take ? "✔ Взяти" : "✘ Пропустити"}</td>
        <td>П.${s.itemId}</td>
        <td>${s.weight}</td>
        <td>${s.value}</td>
        <td>${s.ub}</td>
        <td>${s.pruned ? "✂ Так" : "—"}</td>
      </tr>`;
    }
  }

  if (steps.length > maxShow) {
    html += `<tr><td colspan="7" class="warn-text">… ще ${steps.length - maxShow} кроків …</td></tr>`;
  }
  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function renderBranchBoundStepByStep(steps, result, delay) {
  const wrapper = document.getElementById("table-wrapper");
  const ei = result.extraInfo;

  wrapper.innerHTML = `
    <div class="method-info-box">
      <strong>Гілки і межі:</strong> покрокове відгалуження та відсікання.<br>
      Всього вузлів: ${ei.nodeCount} | Відсічено: ${ei.pruned}
    </div>
    <table id="bb-table">
      <thead>
        <tr><th>#</th><th>Тип</th><th>Предмет</th><th>Вага</th>
            <th>Цінність</th><th>Верхня межа</th><th>Відсічено?</th></tr>
      </thead>
      <tbody id="bb-tbody"></tbody>
    </table>`;

  const tbody = document.getElementById("bb-tbody");
  let nodeIdx = 0;

  for (const s of steps) {
    if (s.type === "newBest") {
      const tr = document.createElement("tr");
      tr.className = "bb-best-row anim-row";
      tr.innerHTML = `<td colspan="7">⭐ Новий кращий: ${s.value} (${s.items})</td>`;
      tbody.appendChild(tr);
      setStatus(`⭐ Знайдено новий кращий результат: ${s.value}`);
    } else {
      nodeIdx++;
      const cls = s.pruned ? "bf-bad-row anim-row" : (s.take ? "bf-ok-row anim-row" : "anim-row");
      const tr = document.createElement("tr");
      tr.className = cls;
      tr.innerHTML = `
        <td>${nodeIdx}</td>
        <td>${s.take ? "✔ Взяти" : "✘ Пропустити"}</td>
        <td>П.${s.itemId}</td>
        <td>${s.weight}</td>
        <td>${s.value}</td>
        <td>${s.ub}</td>
        <td>${s.pruned ? "✂ Так" : "—"}</td>`;
      tbody.appendChild(tr);
      setStatus(`Вузол ${nodeIdx}: ${s.take?"Взяти":"Пропустити"} П.${s.itemId}, цінність=${s.value}, UB=${s.ub} ${s.pruned?"→ ВІДСІЧЕНО":""}`);
    }
    appendStepLog(`Вузол ${nodeIdx}: П.${s.itemId ?? "—"} ${s.take?"взяти":"пропустити"}, UB=${s.ub ?? "—"} ${s.pruned?"[ВІДСІЧЕНО]":""}`);
    tbody.scrollTop = tbody.scrollHeight;
    await sleep(delay);
  }
  clearHighlights();
}

/* ══════════════════════════════════════════════════════
   RESULTS
══════════════════════════════════════════════════════ */

function renderResults(result) {
  const totalW = result.selectedItems.reduce((s, i) => s + i.weight, 0);
  const totalV = result.selectedItems.reduce((s, i) => s + i.value,  0);
  const ids    = result.selectedItems.map(i => i.id).join(", ");
  document.getElementById("res-value") .textContent = result.maxValue;
  document.getElementById("res-items") .textContent = ids || "—";
  document.getElementById("res-weight").textContent = totalW;
  document.getElementById("res-total") .textContent = totalV;

  // Extra info
  const extra = document.getElementById("res-extra");
  if (extra && result.extraInfo) {
    const ei = result.extraInfo;
    let html = "";
    if (ei.complexity)    html += `<p><strong>Складність:</strong> ${ei.complexity}</p>`;
    if (ei.totalSubsets)  html += `<p><strong>Підмножин перебрано:</strong> ${ei.totalSubsets}</p>`;
    if (ei.callCount)     html += `<p><strong>Рекурсивних викликів:</strong> ${ei.callCount}</p>`;
    if (ei.cacheHits)     html += `<p><strong>Влучань у кеш:</strong> ${ei.cacheHits}</p>`;
    if (ei.sortedOrder)   html += `<p><strong>Порядок жадібного:</strong> ${ei.sortedOrder}</p>`;
    if (ei.isOptimal !== undefined)
      html += `<p>${ei.isOptimal ? "✔ Результат оптимальний" : `⚠ Не оптимально! ДП дає: ${ei.dpOptimal}`}</p>`;
    if (ei.nodeCount)     html += `<p><strong>Вузлів у дереві:</strong> ${ei.nodeCount}</p>`;
    if (ei.efficiency)    html += `<p><strong>Відсічено:</strong> ${ei.efficiency}</p>`;
    extra.innerHTML = html;
  }
}

/* ══════════════════════════════════════════════════════
   ЛОГ КРОКІВ
══════════════════════════════════════════════════════ */

function appendStepLog(text) {
  const log = document.getElementById("steps-log");
  if (!log) return;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function clearStepLog() {
  const log = document.getElementById("steps-log");
  if (log) log.innerHTML = "";
}
