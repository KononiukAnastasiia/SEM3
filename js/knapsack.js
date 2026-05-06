/**
 * @fileoverview Алгоритм задачі «Рюкзак» — всі 5 методів вирішення
 * @module knapsack
 */
"use strict";

/* ══════════════════════════════════════════════════════
   ВАЛІДАЦІЯ
══════════════════════════════════════════════════════ */

function validateVariantData(data) {
  if (!data) throw new Error("Дані варіанта відсутні.");
  if (!Number.isInteger(data.capacity) || data.capacity <= 0)
    throw new Error("Місткість рюкзака повинна бути цілим числом > 0.");
  if (!Array.isArray(data.weights) || !Array.isArray(data.values))
    throw new Error("Вектори ваг і цінностей повинні бути масивами.");
  if (data.weights.length !== data.values.length)
    throw new Error(`Кількість ваг (${data.weights.length}) і цінностей (${data.values.length}) не збігається.`);
  if (data.weights.length === 0) throw new Error("Список предметів порожній.");
  if (data.weights.some(w => !Number.isInteger(w) || w <= 0))
    throw new Error("Усі ваги повинні бути додатними цілими числами.");
  if (data.values.some(v => typeof v !== "number" || v < 0))
    throw new Error("Усі цінності повинні бути невід'ємними числами.");
  return true;
}

/* ══════════════════════════════════════════════════════
   МЕТОД 1 — ГРУБА СИЛА (Brute Force)
   Перебирає всі 2^n підмножини предметів.
   Складність: O(2^n) час, O(n) пам'ять
══════════════════════════════════════════════════════ */

/**
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ maxValue:number, selectedItems:Array, steps:Array, extraInfo:Object }}
 */
function solveBruteForce(items, capacity) {
  const n = items.length;
  const totalSubsets = 1 << n; // 2^n
  const steps = [];

  let bestValue  = 0;
  let bestMask   = 0;
  let bestWeight = 0;

  for (let mask = 0; mask < totalSubsets; mask++) {
    let totalW = 0, totalV = 0;
    const subset = [];
    for (let bit = 0; bit < n; bit++) {
      if (mask & (1 << bit)) {
        totalW += items[bit].weight;
        totalV += items[bit].value;
        subset.push(items[bit].id);
      }
    }

    const feasible = totalW <= capacity;
    const isBest   = feasible && totalV > bestValue;

    steps.push({
      mask,
      binaryMask: mask.toString(2).padStart(n, "0"),
      subset,
      totalW,
      totalV,
      feasible,
      isBest,
    });

    if (isBest) {
      bestValue  = totalV;
      bestMask   = mask;
      bestWeight = totalW;
    }
  }

  // Відновлення обраних предметів
  const selectedItems = [];
  for (let bit = 0; bit < n; bit++) {
    if (bestMask & (1 << bit)) selectedItems.push(items[bit]);
  }

  return {
    maxValue: bestValue,
    selectedItems,
    steps,
    extraInfo: {
      totalSubsets,
      bestMask: bestMask.toString(2).padStart(n, "0"),
      bestWeight,
    },
  };
}

/* ══════════════════════════════════════════════════════
   МЕТОД 2 — РЕКУРСІЯ З МЕМОІЗАЦІЄЮ (Top-Down DP)
   Рекурсивне розбиття на підзадачі + кеш.
   Складність: O(n·W) час і пам'ять
══════════════════════════════════════════════════════ */

/**
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ maxValue:number, selectedItems:Array, steps:Array, extraInfo:Object }}
 */
function solveMemoization(items, capacity) {
  const n    = items.length;
  const memo = new Map();
  const steps = [];
  let callCount = 0;

  function knapsack(i, w) {
    if (i === 0 || w === 0) return 0;
    const key = `${i},${w}`;
    if (memo.has(key)) {
      steps.push({ i, w, cached: true, value: memo.get(key) });
      return memo.get(key);
    }
    callCount++;
    const item = items[i - 1];
    let result;
    if (item.weight > w) {
      result = knapsack(i - 1, w);
      steps.push({ i, w, cached: false, skipped: true, value: result,
        decision: `Предмет ${item.id} (вага=${item.weight}) > w=${w} → пропуск` });
    } else {
      const without = knapsack(i - 1, w);
      const with_   = knapsack(i - 1, w - item.weight) + item.value;
      result = Math.max(without, with_);
      steps.push({ i, w, cached: false, skipped: false, value: result,
        without, with: with_,
        decision: `max(без=${without}, з=${with_}) = ${result}` });
    }
    memo.set(key, result);
    return result;
  }

  const maxValue = knapsack(n, capacity);

  // Відновлення розв'язку
  const selectedItems = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    const key  = `${i},${w}`;
    const keyP = `${i - 1},${w}`;
    const cur  = memo.get(key)  ?? 0;
    const prev = memo.get(keyP) ?? 0;
    if (cur !== prev) {
      selectedItems.push(items[i - 1]);
      w -= items[i - 1].weight;
    }
  }
  selectedItems.reverse();

  return {
    maxValue,
    selectedItems,
    steps,
    extraInfo: { callCount, cacheHits: steps.filter(s => s.cached).length, memoSize: memo.size },
  };
}

/* ══════════════════════════════════════════════════════
   МЕТОД 3 — ЖАДІБНИЙ (Greedy by value/weight ratio)
   Сортує за спаданням питомої цінності v/w.
   НЕ гарантує оптимум для 0/1-рюкзака.
   Складність: O(n log n)
══════════════════════════════════════════════════════ */

/**
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ maxValue:number, selectedItems:Array, steps:Array, extraInfo:Object }}
 */
function solveGreedy(items, capacity) {
  // Сортування за питомою цінністю (спадання)
  const sorted = items
    .map(item => ({ ...item, ratio: item.value / item.weight }))
    .sort((a, b) => b.ratio - a.ratio);

  const steps = [];
  const selectedItems = [];
  let remainingW = capacity;
  let totalValue = 0;

  for (const item of sorted) {
    const fits = item.weight <= remainingW;
    steps.push({
      itemId:    item.id,
      weight:    item.weight,
      value:     item.value,
      ratio:     item.ratio.toFixed(3),
      remaining: remainingW,
      fits,
      decision: fits
        ? `✔ Додаємо предмет ${item.id} (v/w=${item.ratio.toFixed(2)}), залишок=${remainingW - item.weight}`
        : `✘ Предмет ${item.id} не вміщується (вага=${item.weight} > залишок=${remainingW})`,
    });
    if (fits) {
      selectedItems.push(item);
      remainingW -= item.weight;
      totalValue += item.value;
    }
  }

  // Перевірка оптимальності через ДП
  const dpResult = buildDpTable(items, capacity);
  const dpOptimal = dpResult.dp[items.length][capacity];
  const isOptimal = totalValue === dpOptimal;

  return {
    maxValue: totalValue,
    selectedItems,
    steps,
    extraInfo: {
      sortedOrder: sorted.map(i => `П.${i.id}(${i.ratio.toFixed(2)})`).join(" → "),
      isOptimal,
      dpOptimal,
      gap: dpOptimal - totalValue,
    },
  };
}

/* ══════════════════════════════════════════════════════
   МЕТОД 4 — ДИНАМІЧНЕ ПРОГРАМУВАННЯ (Bottom-Up DP)
   Класичний табличний підхід.
   Складність: O(n·W) час і пам'ять
══════════════════════════════════════════════════════ */

/**
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ dp:number[][], steps:Array }}
 */
function buildDpTable(items, capacity) {
  const n  = items.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  const steps = [];

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    for (let w = 0; w <= capacity; w++) {
      const withoutItem = dp[i - 1][w];
      let withItem = -Infinity;
      let decision = "";
      if (item.weight > w) {
        dp[i][w] = withoutItem;
        decision = `Предмет ${item.id} (вага=${item.weight}) не вміщується при w=${w}. Залишаємо ${withoutItem}.`;
      } else {
        withItem  = dp[i - 1][w - item.weight] + item.value;
        dp[i][w]  = Math.max(withoutItem, withItem);
        decision  = `max(без=${withoutItem}, з=${withItem}) = ${dp[i][w]}`;
      }
      steps.push({ i, w, value: dp[i][w], decision, withoutItem, withItem, itemId: item.id });
    }
  }
  return { dp, steps };
}

/**
 * @param {number[][]} dp
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ selectedItems:Array, path:Array<{i,w}> }}
 */
function reconstructSolution(dp, items, capacity) {
  const selectedItems = [];
  const path = [];
  let i = items.length, w = capacity;
  while (i > 0 && w >= 0) {
    path.push({ i, w });
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedItems.push(items[i - 1]);
      w -= items[i - 1].weight;
    }
    i--;
  }
  if (w >= 0 && i === 0) path.push({ i: 0, w });
  selectedItems.reverse();
  return { selectedItems, path };
}

/**
 * Повний розв'язок методом ДП (для уніфікованого інтерфейсу)
 */
function solveDynamic(items, capacity) {
  const { dp, steps } = buildDpTable(items, capacity);
  const { selectedItems, path } = reconstructSolution(dp, items, capacity);
  const maxValue = dp[items.length][capacity];
  return {
    maxValue, selectedItems, steps,
    extraInfo: { dp, path, complexity: `O(${items.length}×${capacity})=${items.length * capacity} операцій` },
  };
}

/* ══════════════════════════════════════════════════════
   МЕТОД 5 — ГІЛКИ І МЕЖІ (Branch & Bound)
   Дерево пошуку з верхньою оцінкою (upper bound).
   Складність: O(2^n) у гіршому випадку, краще на практиці
══════════════════════════════════════════════════════ */

/**
 * Upper bound: жадібний дріб (fractional knapsack) для залишкових предметів.
 */
function upperBound(idx, currentW, currentV, sortedItems, capacity) {
  let w = currentW, v = currentV;
  for (let i = idx; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    if (w + item.weight <= capacity) {
      w += item.weight; v += item.value;
    } else {
      const frac = (capacity - w) / item.weight;
      v += frac * item.value;
      break;
    }
  }
  return v;
}

/**
 * @param {Array<{id,weight,value}>} items
 * @param {number} capacity
 * @returns {{ maxValue:number, selectedItems:Array, steps:Array, extraInfo:Object }}
 */
function solveBranchBound(items, capacity) {
  // Сортуємо за питомою цінністю (для upper bound)
  const sorted = items
    .map(item => ({ ...item, ratio: item.value / item.weight }))
    .sort((a, b) => b.ratio - a.ratio);

  const steps  = [];
  let best     = 0;
  let bestSet  = [];
  let nodeCount = 0;
  let pruned   = 0;

  // BFS-черга: { idx, weight, value, taken[] }
  const queue = [{ idx: 0, weight: 0, value: 0, taken: [] }];

  while (queue.length > 0) {
    const node = queue.shift();
    nodeCount++;

    if (node.idx === sorted.length) {
      if (node.value > best) {
        best    = node.value;
        bestSet = node.taken.slice();
        steps.push({ type: "newBest", value: best,
          items: bestSet.map(i => `П.${i.id}`).join(","),
          node: nodeCount });
      }
      continue;
    }

    const item = sorted[node.idx];

    // Гілка 1: беремо item
    if (node.weight + item.weight <= capacity) {
      const newTaken  = [...node.taken, item];
      const newValue  = node.value + item.value;
      const newWeight = node.weight + item.weight;
      const ub        = upperBound(node.idx + 1, newWeight, newValue, sorted, capacity);

      steps.push({ type: "branch", take: true, itemId: item.id,
        value: newValue, weight: newWeight, ub: ub.toFixed(1),
        pruned: ub <= best, node: nodeCount });

      if (ub > best) {
        queue.push({ idx: node.idx + 1, weight: newWeight, value: newValue, taken: newTaken });
      } else { pruned++; }
    }

    // Гілка 2: не беремо item
    {
      const ub = upperBound(node.idx + 1, node.weight, node.value, sorted, capacity);
      steps.push({ type: "branch", take: false, itemId: item.id,
        value: node.value, weight: node.weight, ub: ub.toFixed(1),
        pruned: ub <= best, node: nodeCount });

      if (ub > best) {
        queue.push({ idx: node.idx + 1, weight: node.weight, value: node.value, taken: node.taken });
      } else { pruned++; }
    }
  }

  // Повертаємо до оригінальних id (sorted може змінити порядок)
  const selectedItems = items.filter(item => bestSet.some(s => s.id === item.id));

  return {
    maxValue: best,
    selectedItems,
    steps,
    extraInfo: { nodeCount, pruned, efficiency: `${((1 - nodeCount / (1 << items.length)) * 100).toFixed(1)}% відсічено` },
  };
}

/* ══════════════════════════════════════════════════════
   УНІФІКОВАНИЙ ДИСПЕТЧЕР
══════════════════════════════════════════════════════ */

/**
 * Запускає потрібний метод за його ідентифікатором.
 * @param {number} methodId  - 1..5
 * @param {Array}  items
 * @param {number} capacity
 * @returns {{ maxValue, selectedItems, steps, extraInfo, methodId }}
 */
function solveByMethod(methodId, items, capacity) {
  let result;
  switch (methodId) {
    case 1: result = solveBruteForce(items, capacity);  break;
    case 2: result = solveMemoization(items, capacity); break;
    case 3: result = solveGreedy(items, capacity);      break;
    case 4: result = solveDynamic(items, capacity);     break;
    case 5: result = solveBranchBound(items, capacity); break;
    default: throw new Error(`Невідомий метод: ${methodId}`);
  }
  return { ...result, methodId };
}
