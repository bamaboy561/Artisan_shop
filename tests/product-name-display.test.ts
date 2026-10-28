import assert from "node:assert/strict";
import test from "node:test";

import {
  displayProductName,
  tidyProductName,
} from "../features/storefront/plate-gallery";

test("названия ЗАГЛАВНЫМИ из 1С читаются обычным регистром", () => {
  assert.equal(
    tidyProductName("DOLCE 200ММ РУЧКА ПОЛНАЯ ЗОЛОТАЯ ФОЛЬГА"),
    "DOLCE 200мм ручка полная золотая фольга",
  );
  assert.equal(
    tidyProductName("HAWAII AKS:016ММ РУЧКА СУСАЛЬНОЕ ЗОЛОТО"),
    "HAWAII AKS:016мм ручка сусальное золото",
  );
  assert.equal(
    tidyProductName("РУЧКА-СКОБА CRUZ ELIT 730ММ"),
    "Ручка-скоба CRUZ ELIT 730мм",
  );
});

test("аббревиатуры материалов и обычные названия не портятся", () => {
  assert.equal(
    tidyProductName("ЛДСП БЕЛЫЙ ГЛАДКИЙ 16ММ"),
    "ЛДСП белый гладкий 16мм",
  );
  assert.equal(
    tidyProductName("Дуб Сонома ЛДСП 16 мм"),
    "Дуб Сонома ЛДСП 16 мм",
  );
  assert.equal(tidyProductName("BLUM CLIP TOP"), "BLUM CLIP TOP");
});

test("пробел перед скобкой и лишние пробелы", () => {
  assert.equal(
    tidyProductName("Ножки(Опора)  EMAKS"),
    "Ножки (Опора) EMAKS",
  );
});

test("у плит размер листа по-прежнему убирается из названия", () => {
  assert.equal(
    displayProductName({
      name: "ДУБ КОМИ 2.75*1.83",
      format: "2750 × 1830 мм, 16 мм",
    }),
    "Дуб Коми",
  );
});
