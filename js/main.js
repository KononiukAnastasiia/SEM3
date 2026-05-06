/**
 * @fileoverview Головний модуль — керування всіма 5 методами задачі «Рюкзак»
 * @module main
 */
"use strict";

/* ══════════════════════════════════════════════════════
   СТАН ЗАСТОСУНКУ
══════════════════════════════════════════════════════ */
let allItems     = [];
let checkedIds   = new Set();
let activeMethod = 4;          // поточний метод (1–5)
let lastResult   = null;       // результат останнього запуску
let dp           = null;       // таблиця dp (тільки для методу 4)
let activeItems  = [];
let isAnimating  = false;

/* ══════════════════════════════════════════════════════
   КОНФІГУРАЦІЯ МЕТОДІВ
══════════════════════════════════════════════════════ */
const METHODS = {
  1: {
    name:       "Груба сила",
    shortName:  "Груба сила",
    icon:       "💪",
    complexity: "O(2ⁿ)",
    desc:       "Перебір усіх 2ⁿ підмножин предметів. Гарантує оптимум, але повільно при n > 20.",
    stepLabel:  "Перебрати покроково",
    warnIfN:    18,
  },
  2: {
    name:       "Рекурсія + мемоізація",
    shortName:  "Мемоізація",
    icon:       "🧮",
    complexity: "O(n·W)",
    desc:       "Рекурсивне розбиття на підзадачі з кешем (Top-Down DP). Обчислює тільки потрібні стани.",
    stepLabel:  "Заповнити кеш покроково",
    warnIfN:    null,
  },
  3: {
    name:       "Жадібний алгоритм",
    shortName:  "Жадібний",
    icon:       "🏃",
    complexity: "O(n log n)",
    desc:       "Сортує за питомою цінністю v/w та жадібно додає предмети. Не гарантує оптимум для 0/1-рюкзака.",
    stepLabel:  "Додавати покроково",
    warnIfN:    null,
  },
  4: {
    name:       "Динамічне програмування",
    shortName:  "ДП (Bottom-Up)",
    icon:       "📊",
    complexity: "O(n·W)",
    desc:       "Класичний табличний підхід (Bottom-Up DP). Гарантований оптимум, наочна таблиця dp[i][w].",
    stepLabel:  "Побудувати покроково",
    warnIfN:    null,
  },
  5: {
    name:       "Гілки і межі",
    shortName:  "Гілки і межі",
    icon:       "🌿",
    complexity: "O(2ⁿ) worst",
    desc:       "Дерево пошуку з відсіканням гілок за верхньою оцінкою (fractional bound). Краще за грубий перебір.",
    stepLabel:  "Розгалужувати покроково",
    warnIfN:    null,
  },
};

/* ══════════════════════════════════════════════════════
   ІНІЦІАЛІЗАЦІЯ
══════════════════════════════════════════════════════ */
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

  // Кнопки
  document.getElementById("buildBtn")   .addEventListener("click", handleBuild);
  document.getElementById("stepBtn")    .addEventListener("click", handleStepBuild);
  document.getElementById("restoreBtn") .addEventListener("click", handleRestore);
  document.getElementById("resetBtn")   .addEventListener("click", handleReset);
  document.getElementById("selectAllBtn").addEventListener("click", handleSelectAll);
  document.getElementById("clearAllBtn") .addEventListener("click", handleClearAll);
  document.getElementById("capacityInput").addEventListener("input", () => {
    invalidateTable(); updateStatus();
  });

  // Клік по картці методу
  document.querySelectorAll(".method-card").forEach(card => {
    card.addEventListener("click", () => {
      const mid = parseInt(card.dataset.method, 10);
      if (!isNaN(mid)) selectMethod(mid);
    });
  });

  buildMethodCards(); // первинна відрисовка карток методів
  selectMethod(4);    // за замовчуванням — ДП
  updateStatus();
});

/* ══════════════════════════════════════════════════════
   ВИБІР МЕТОДУ
══════════════════════════════════════════════════════ */

function buildMethodCards() {
  const grid = document.getElementById("methods-grid");
  if (!grid) return;
  grid.innerHTML = Object.entries(METHODS).map(([id, m]) => `
    <div class="method-card${parseInt(id) === activeMethod ? " active-method" : ""}"
         data-method="${id}" title="${m.desc}">
      <div class="method-card-icon">${m.icon}</div>
      <h4>Метод ${id} — ${m.shortName}</h4>
      <p>${m.desc}</p>
      <span class="complexity">${m.complexity}</span>
    </div>`).join("");

  // Re-attach listeners after rebuild
  document.querySelectorAll(".method-card").forEach(card => {
    card.addEventListener("click", () => {
      const mid = parseInt(card.dataset.method, 10);
      if (!isNaN(mid)) selectMethod(mid);
    });
  });
}

function selectMethod(mid) {
  if (isAnimating) return;
  activeMethod = mid;
  const m = METHODS[mid];

  // Підсвічення активної картки
  document.querySelectorAll(".method-card").forEach(card => {
    card.classList.toggle("active-method", parseInt(card.dataset.method) === mid);
  });

  // Оновлюємо підписи кнопок
  const stepBtn = document.getElementById("stepBtn");
  if (stepBtn) stepBtn.textContent = `▶ ${m.stepLabel}`;

  // Показ/приховування кнопки «Відновити» (тільки для ДП)
  const restoreBtn = document.getElementById("restoreBtn");
  if (restoreBtn) restoreBtn.style.display = mid === 4 ? "" : "none";

  // Відображення підпису активного методу
  const badge = document.getElementById("active-method-badge");
  if (badge) {
    badge.textContent = `${m.icon} Активний метод: Метод ${mid} — ${m.name} [${m.complexity}]`;
  }

  // Підказка про складність
  const hint = document.getElementById("method-warning");
  if (hint) {
    const n = checkedIds.size;
    if (m.warnIfN && n > m.warnIfN) {
      hint.textContent = `⚠ При n=${n} груба сила перебирає ${(1<<n).toLocaleString()} підмножин — може бути повільно!`;
      hint.style.display = "";
    } else {
      hint.style.display = "none";
    }
  }

  invalidateTable();
  updateStatus();
}

/* ══════════════════════════════════════════════════════
   КЛІКИ ПО ПРЕДМЕТАХ
══════════════════════════════════════════════════════ */

window.toggleItem = function(id) {
  if (isAnimating) return;
  if (checkedIds.has(id)) checkedIds.delete(id);
  else checkedIds.add(id);
  const card = document.getElementById(`item-${id}`);
  if (card) card.classList.toggle("checked", checkedIds.has(id));
  updateSelectionSummary(allItems, checkedIds);
  invalidateTable();
  updateStatus();
  // Оновлюємо попередження для методів з exp. складністю
  selectMethod(activeMethod);
};

function handleSelectAll() {
  allItems.forEach(i => checkedIds.add(i.id));
  renderItemCards(allItems, checkedIds);
  invalidateTable(); updateStatus(); selectMethod(activeMethod);
}

function handleClearAll() {
  checkedIds.clear();
  renderItemCards(allItems, checkedIds);
  invalidateTable(); updateStatus();
}

/* ══════════════════════════════════════════════════════
   ДОПОМІЖНІ ФУНКЦІЇ
══════════════════════════════════════════════════════ */

function invalidateTable() {
  dp = null; lastResult = null; activeItems = [];
  resetResults();
  clearStepLog();
  document.querySelectorAll(".item-card.selected-item").forEach(c => c.classList.remove("selected-item"));
  document.getElementById("table-wrapper").innerHTML =
    `<p class="empty-hint">Вибір або місткість змінились — побудуйте таблицю заново.</p>`;
}

function getSelectedItems() {
  return allItems.filter(i => checkedIds.has(i.id));
}

function getCapacity() {
  const val = parseInt(document.getElementById("capacityInput").value, 10);
  if (isNaN(val) || val < 1) return 1;
  if (val > 50) return 50;
  return val;
}

function validateBeforeRun() {
  const sel = getSelectedItems();
  if (sel.length === 0) {
    setStatus("⚠ Оберіть хоча б один предмет.");
    return false;
  }
  if (getCapacity() < 1) {
    setStatus("⚠ Місткість рюкзака має бути ≥ 1.");
    return false;
  }
  const m = METHODS[activeMethod];
  if (m.warnIfN && sel.length > m.warnIfN) {
    // Дозволяємо, але попереджаємо
    setStatus(`⚠ n=${sel.length} → ${(1<<sel.length).toLocaleString()} підмножин. Це може зайняти час…`);
  }
  return true;
}

function updateStatus() {
  const sel = getSelectedItems();
  const W   = getCapacity();
  const m   = METHODS[activeMethod];
  if (sel.length === 0) {
    setStatus("⚠ Не вибрано жодного предмета. Клікніть на картки для вибору.");
  } else {
    setStatus(`Метод ${activeMethod}: ${m.name} | Вибрано ${sel.length} предмет(ів), W=${W}. Натисніть кнопку.`);
  }
}

function setButtons(enabled) {
  ["buildBtn","stepBtn","restoreBtn","resetBtn","selectAllBtn","clearAllBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
  document.querySelectorAll(".method-card").forEach(c => {
    c.style.pointerEvents = enabled ? "" : "none";
    c.style.opacity = enabled ? "" : "0.5";
  });
}

/* ══════════════════════════════════════════════════════
   ОБРОБНИКИ КНОПОК
══════════════════════════════════════════════════════ */

/** Миттєве розв'язання */
function handleBuild() {
  if (isAnimating || !validateBeforeRun()) return;
  const sel = getSelectedItems();
  const W   = getCapacity();
  activeItems = sel;
  clearStepLog();

  const result = solveByMethod(activeMethod, sel, W);
  lastResult = result;

  // Для ДП зберігаємо окремо таблицю
  if (activeMethod === 4) {
    dp = result.extraInfo.dp;
    fillTableImmediately(dp, sel, W);
  } else {
    renderMethodResult(result, sel, W);
  }

  renderResults(result);
  highlightSelectedItems(result.selectedItems);
  const ids = result.selectedItems.map(i => i.id).join(", ");
  setStatus(`✅ [Метод ${activeMethod}] Готово! Оптимальна цінність: ${result.maxValue} | Предмети: [${ids || "—"}]`);
}

/** Покрокове розв'язання */
async function handleStepBuild() {
  if (isAnimating || !validateBeforeRun()) return;
  const sel = getSelectedItems();
  const W   = getCapacity();
  activeItems = sel;
  clearStepLog();

  const result = solveByMethod(activeMethod, sel, W);
  lastResult = result;

  if (activeMethod === 4) dp = result.extraInfo.dp;

  const delay = getAnimDelay();

  isAnimating = true;
  setButtons(false);
  try {
    await animateMethod(activeMethod, result, sel, W, delay);
  } finally {
    isAnimating = false;
    setButtons(true);
  }

  renderResults(result);
  highlightSelectedItems(result.selectedItems);

  // Для ДП — підсвічуємо шлях після анімації
  if (activeMethod === 4 && result.extraInfo.path) {
    highlightSolutionPath(result.extraInfo.path, result.selectedItems, allItems);
  }

  const ids = result.selectedItems.map(i => i.id).join(", ");
  setStatus(`✅ [Метод ${activeMethod}] Анімацію завершено! Оптимальна цінність: ${result.maxValue} | Предмети: [${ids || "—"}]`);
}

/** Відновлення розв'язку (тільки для ДП) */
function handleRestore() {
  if (isAnimating) return;
  if (activeMethod !== 4) {
    setStatus("ℹ Відновлення шляху доступне лише для методу 4 (ДП).");
    return;
  }
  if (!lastResult || !lastResult.extraInfo || !lastResult.extraInfo.dp) {
    setStatus("⚠ Спочатку побудуйте таблицю ДП.");
    return;
  }
  const path = lastResult.extraInfo.path;
  if (path) highlightSolutionPath(path, lastResult.selectedItems, allItems);
  renderResults(lastResult);
  highlightSelectedItems(lastResult.selectedItems);
  const ids = lastResult.selectedItems.map(i => i.id).join(", ");
  setStatus(`🔍 Розв'язок відновлено: предмети [${ids || "—"}], цінність ${lastResult.maxValue}`);
}

/** Скидання */
function handleReset() {
  if (isAnimating) return;
  dp = null; lastResult = null; activeItems = [];
  resetUI();
}

/* ══════════════════════════════════════════════════════
   ДИСПЕТЧЕР ВІДОБРАЖЕННЯ РЕЗУЛЬТАТІВ
══════════════════════════════════════════════════════ */

function renderMethodResult(result, items, capacity) {
  switch (result.methodId) {
    case 1: renderBruteForceTable(result.steps, items, capacity); break;
    case 2: renderMemoTable(result.steps, items, capacity);       break;
    case 3: renderGreedyTable(result.steps, result);              break;
    case 4: /* заповнюється fillTableImmediately */               break;
    case 5: renderBranchBoundTable(result.steps, result);         break;
  }
}

async function animateMethod(methodId, result, items, capacity, delay) {
  switch (methodId) {
    case 1:
      await renderBruteForceStepByStep(result.steps, items, capacity, delay);
      break;
    case 2:
      await renderMemoStepByStep(result.steps, items, capacity, delay);
      break;
    case 3:
      await renderGreedyStepByStep(result.steps, result, delay);
      break;
    case 4:
      renderEmptyTable(items, capacity);
      await fillTableStepByStep(result.steps, delay);
      break;
    case 5:
      await renderBranchBoundStepByStep(result.steps, result, delay);
      break;
  }
}

/* ══════════════════════════════════════════════════════
   ПІДСВІЧЕННЯ ОБРАНИХ ПРЕДМЕТІВ
══════════════════════════════════════════════════════ */

function highlightSelectedItems(selectedItems) {
  document.querySelectorAll(".item-card.selected-item").forEach(c => c.classList.remove("selected-item"));
  selectedItems.forEach(item => {
    const card = document.getElementById(`item-${item.id}`);
    if (card) card.classList.add("selected-item");
  });
}

/* ══════════════════════════════════════════════════════
   ШВИДКІСТЬ АНІМАЦІЇ
══════════════════════════════════════════════════════ */

function getAnimDelay() {
  const slider = document.getElementById("speedRange");
  if (!slider) return 120;
  const val = parseInt(slider.value, 10); // 1–5
  const delays = [600, 300, 120, 50, 15];
  return delays[val - 1] ?? 120;
}
