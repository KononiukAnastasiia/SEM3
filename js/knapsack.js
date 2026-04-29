/**
 * @fileoverview Алгоритм розв'язання задачі «Рюкзак» методом динамічного програмування.
 * @module knapsack
 *
 * Реалізує:
 *   1. Валідацію вхідних даних
 *   2. Побудову таблиці dp[i][w] — O(n·W) за часом і пам'яттю
 *   3. Відновлення оптимального набору предметів
 */

"use strict";

/* 1. ВАЛІДАЦІЯ*/

/**
 * @param {Object} data
 * @throws {Error}
 * @returns {true}
 */
function validateVariantData(data) {
  if (!data) {
    throw new Error("Дані варіанта відсутні.");
  }
  if (!Number.isInteger(data.capacity) || data.capacity <= 0) {
    throw new Error("Місткість рюкзака повинна бути цілим числом більше 0.");
  }
  if (!Array.isArray(data.weights) || !Array.isArray(data.values)) {
    throw new Error("Вектори ваг і цінностей повинні бути масивами.");
  }
  if (data.weights.length !== data.values.length) {
    throw new Error(
      `Кількість ваг (${data.weights.length}) і цінностей (${data.values.length}) не збігається.`
    );
  }
  if (data.weights.length === 0) {
    throw new Error("Список предметів порожній.");
  }
  if (data.weights.some(w => !Number.isInteger(w) || w <= 0)) {
    throw new Error("Усі ваги повинні бути додатними цілими числами.");
  }
  if (data.values.some(v => typeof v !== "number" || v < 0)) {
    throw new Error("Усі цінності повинні бути невід'ємними числами.");
  }
  return true;
}

/* 2. ПОБУДОВА ТАБЛИЦІ ДП */

/**

 @param {Array<{id:number, weight:number, value:number}>} items 
 @param {number} capacity 
 @returns {{ dp: number[][], steps: Array<Object> }}
 */
function buildDpTable(items, capacity) {
  const n = items.length;

  const dp = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  /** @type {Array<{i, w, value, decision, withoutItem, withItem, itemId}>} */
  const steps = [];

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1]; 

    for (let w = 0; w <= capacity; w++) {
      const withoutItem = dp[i - 1][w];   
      let withItem      = -Infinity;      
      let decision      = "";

      if (item.weight > w) {
        dp[i][w] = withoutItem;
        decision = `Предмет ${item.id} (вага=${item.weight}) не вміщується при w=${w}. Залишаємо dp[${i-1}][${w}]=${withoutItem}.`;
      } else {
        withItem = dp[i - 1][w - item.weight] + item.value;
        dp[i][w] = Math.max(withoutItem, withItem);
        decision =
          `Предмет ${item.id} (w=${item.weight}, v=${item.value}), місткість=${w}: ` +
          `max(без=${withoutItem}, з=${withItem}) = ${dp[i][w]}.`;
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
 * @returns {{ selectedItems: Array, path: Array<{i,w}> }}
 */
function reconstructSolution(dp, items, capacity) {
  const selectedItems = [];
  /** @type {Array<{i:number, w:number}>} */
  const path = [];

  let i = items.length;
  let w = capacity;

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
