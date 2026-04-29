/**
 * @fileoverview 
 * @module ui
 */
"use strict";

/**
 * Рендерить блок з параметрами варіанта та інтерактивні картки предметів.
 * Картка кликається → toggleItem(id).
 * @param {Object} data  - variantData
 * @param {Array}  items - всі предмети варіанта
 * @param {Set<number>} checkedIds - id предметів, що зараз вибрані
 */
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

/**
 * Малює картки предметів з чекбоксами.
 * @param {Array}  items
 * @param {Set<number>} checkedIds
 */
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
  const el = document.getElementById("selection-summary");
  const sel = items.filter(i => checkedIds.has(i.id));
  const totalW = sel.reduce((s, i) => s + i.weight, 0);
  const totalV = sel.reduce((s, i) => s + i.value, 0);

  if (sel.length === 0) {
    el.textContent = "⚠ Не вибрано жодного предмета.";
    el.className = "selection-summary warn";
  } else {
    el.textContent = `Вибрано предметів: ${sel.length} | Загальна вага: ${totalW} | Загальна цінність: ${totalV}`;
    el.className = "selection-summary";
  }
}

/**
 * Будує порожню таблицю dp для вибраних предметів.
 * @param {Array}  items    - лише вибрані предмети
 * @param {number} capacity
 */
function renderEmptyTable(items, capacity) {
  const wrapper = document.getElementById("table-wrapper");
  let html = `<table id="dp-table"><thead><tr><th style="min-width:90px">i \\ w</th>`;
  for (let w = 0; w <= capacity; w++) html += `<th>${w}</th>`;
  html += `</tr></thead><tbody>`;

  // рядок 0 — базовий
  html += `<tr><td class="row-header">0 (∅)</td>`;
  for (let w = 0; w <= capacity; w++) html += `<td id="cell-0-${w}">0</td>`;
  html += `</tr>`;

  // рядки предметів
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

async function fillTableStepByStep(steps, delay = 180) {
  clearHighlights();
  for (const step of steps) {
    const cell = document.getElementById(`cell-${step.i}-${step.w}`);
    if (!cell) continue;
    clearHighlights();
    cell.classList.add("active-cell");
    cell.textContent = step.value;
    setStatus(`Крок [${step.i}][${step.w}]: ${step.decision}`);
    await sleep(delay);
  }
  clearHighlights();
  setStatus("✅ Таблицю dp побудовано. Натисніть «Відновити розв'язок».");
}

function highlightSolutionPath(path, selectedItems, allItems) {
  // підсвічуємо шлях у таблиці
  path.forEach(({ i, w }) => {
    const cell = document.getElementById(`cell-${i}-${w}`);
    if (cell) cell.classList.add("path-cell");
  });
  // підсвічуємо картки предметів (за originalId)
  selectedItems.forEach(item => {
    const card = document.getElementById(`item-${item.id}`);
    if (card) card.classList.add("selected-item");
  });
}

function renderResults(result) {
  const totalW = result.selectedItems.reduce((s, i) => s + i.weight, 0);
  const totalV = result.selectedItems.reduce((s, i) => s + i.value,  0);
  const ids    = result.selectedItems.map(i => i.id).join(", ");

  document.getElementById("res-value") .textContent = result.maxValue;
  document.getElementById("res-items") .textContent = ids || "—";
  document.getElementById("res-weight").textContent = totalW;
  document.getElementById("res-total") .textContent = totalV;
}

function resetResults() {
  ["res-value","res-items","res-weight","res-total"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });
}

function resetUI() {
  resetResults();
  document.querySelectorAll(".item-card.selected-item").forEach(c => c.classList.remove("selected-item"));
  document.getElementById("table-wrapper").innerHTML =
    `<p class="empty-hint">Таблицю скинуто. Оберіть предмети та запустіть нове моделювання…</p>`;
  setStatus("↺ Скинуто. Оберіть предмети та натисніть кнопку.");
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function clearHighlights() {
  document.querySelectorAll(".active-cell").forEach(c => c.classList.remove("active-cell"));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
