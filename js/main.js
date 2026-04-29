/**
 * @fileoverview
 * @module main
 */
"use strict";

/* ── Стан */
let allItems    = [];          // всі 9 предметів варіанта
let checkedIds  = new Set();   // id вибраних предметів
let dp          = null;
let steps       = [];
let solution    = null;
let activeItems = [];          // підмножина, для якої побудовано таблицю
let isAnimating = false;

/* ── Ініціалізація  */
document.addEventListener("DOMContentLoaded", () => {
  try {
    validateVariantData(variantData);
    allItems   = getItemsFromVariant(variantData);
    checkedIds = new Set(allItems.map(i => i.id)); 

    renderVariantInfo(variantData, allItems, checkedIds);
  } catch (err) {
    setStatus(`❌ Помилка ініціалізації: ${err.message}`);
    return;
  }

  document.getElementById("buildBtn")   .addEventListener("click", handleBuild);
  document.getElementById("stepBtn")    .addEventListener("click", handleStepBuild);
  document.getElementById("restoreBtn") .addEventListener("click", handleRestore);
  document.getElementById("resetBtn")   .addEventListener("click", handleReset);
  document.getElementById("selectAllBtn").addEventListener("click", handleSelectAll);
  document.getElementById("clearAllBtn") .addEventListener("click", handleClearAll);

  // Оновлення статусу при зміні W
  document.getElementById("capacityInput").addEventListener("input", () => {
    invalidateTable();
    updateStatus();
  });

  updateStatus();
});

/* ── Кліки по картках предметів (глобальна функція) */
window.toggleItem = function(id) {
  if (isAnimating) return;
  if (checkedIds.has(id)) {
    checkedIds.delete(id);
  } else {
    checkedIds.add(id);
  }
  // оновлюємо вигляд картки
  const card = document.getElementById(`item-${id}`);
  if (card) card.classList.toggle("checked", checkedIds.has(id));

  updateSelectionSummary(allItems, checkedIds);
  invalidateTable();
  updateStatus();
};

/* ── Вибрати всі / Скинути вибір */
function handleSelectAll() {
  allItems.forEach(i => checkedIds.add(i.id));
  renderItemCards(allItems, checkedIds);
  invalidateTable();
  updateStatus();
}

function handleClearAll() {
  checkedIds.clear();
  renderItemCards(allItems, checkedIds);
  invalidateTable();
  updateStatus();
}

/* ── Скасування попередніх результатів при зміні вибору */
function invalidateTable() {
  dp = null; steps = []; solution = null; activeItems = [];
  resetResults();
  document.querySelectorAll(".item-card.selected-item").forEach(c => c.classList.remove("selected-item"));
  document.getElementById("table-wrapper").innerHTML =
    `<p class="empty-hint">Вибір або місткість змінились — побудуйте таблицю заново.</p>`;
}

/* ── Прочитати поточні вибрані предмети та W  */
function getSelectedItems() {
  return allItems.filter(i => checkedIds.has(i.id));
}

function getCapacity() {
  const val = parseInt(document.getElementById("capacityInput").value, 10);
  if (isNaN(val) || val < 1) return 1;
  if (val > 50) return 50;
  return val;
}

/* ── Валідація перед запуском */
function validateBeforeRun() {
  const sel = getSelectedItems();
  if (sel.length === 0) {
    setStatus("⚠ Оберіть хоча б один предмет перед запуском.");
    return false;
  }
  const W = getCapacity();
  if (W < 1) {
    setStatus("⚠ Місткість рюкзака має бути ≥ 1.");
    return false;
  }
  return true;
}

/* ── ОБРОБНИКИ КНОПОК  */

/** Миттєва побудова таблиці */
function handleBuild() {
  if (isAnimating || !validateBeforeRun()) return;

  const sel = getSelectedItems();
  const W   = getCapacity();
  activeItems = sel;

  const result = buildDpTable(sel, W);
  dp    = result.dp;
  steps = result.steps;

  fillTableImmediately(dp, sel, W);
  setStatus(`🗂 Таблицю побудовано для ${sel.length} предмет(ів), W=${W}. Натисніть «Відновити розв'язок».`);
}

/** Покрокова побудова */
async function handleStepBuild() {
  if (isAnimating || !validateBeforeRun()) return;

  const sel = getSelectedItems();
  const W   = getCapacity();
  activeItems = sel;

  const result = buildDpTable(sel, W);
  dp    = result.dp;
  steps = result.steps;
  solution = null;

  renderEmptyTable(sel, W);

  isAnimating = true;
  setButtons(false);
  try {
    await fillTableStepByStep(steps, 160);
  } finally {
    isAnimating = false;
    setButtons(true);
  }
}

/** Відновлення розв'язку */
function handleRestore() {
  if (isAnimating) return;
  if (!dp) {
    setStatus("⚠ Спочатку побудуйте таблицю.");
    return;
  }

  const W = getCapacity();
  solution = reconstructSolution(dp, activeItems, W);
  const maxValue = dp[activeItems.length][W];

  highlightSolutionPath(solution.path, solution.selectedItems, allItems);
  renderResults({ maxValue, selectedItems: solution.selectedItems });

  const ids = solution.selectedItems.map(i => i.id).join(", ");
  setStatus(`✅ Оптимальний набір: предмети [${ids || "—"}], максимальна цінність: ${maxValue}.`);
}

/** Скидання */
function handleReset() {
  if (isAnimating) return;
  dp = null; steps = []; solution = null; activeItems = [];
  resetUI();
}

/* ── Утиліти  */
function updateStatus() {
  const sel = getSelectedItems();
  const W   = getCapacity();
  if (sel.length === 0) {
    setStatus("⚠ Не вибрано жодного предмета. Клікніть на картки для вибору.");
  } else {
    setStatus(`Вибрано ${sel.length} предмет(ів), W=${W}. Натисніть кнопку для запуску.`);
  }
}

function setButtons(enabled) {
  ["buildBtn","stepBtn","restoreBtn","resetBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}
