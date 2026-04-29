/**
 * @fileoverview 
 * @module data
 */

"use strict";

/** @type {Object} Вхідні дані варіанта */
const variantData = {
  variant:   23,
  itemCount: 9,
  capacity:  14,
  weights:   [3, 5, 4, 2, 3, 9, 5, 6, 6],
  values:    [15, 15, 7, 7, 9, 9, 15, 6, 11]
};

/**
 * @param {Object} data 
 * @returns {Array<{id:number, weight:number, value:number}>}
 */
function getItemsFromVariant(data) {
  return data.weights.map((weight, index) => ({
    id:     index + 1,
    weight: weight,
    value:  data.values[index]
  }));
}
