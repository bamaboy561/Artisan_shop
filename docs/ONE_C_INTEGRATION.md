# Интеграция Artisan с 1С 8.3

Сайт принимает обмен от 1С через защищенный JSON API. 1С должна передавать ключ в одном из заголовков:

```http
Authorization: Bearer <ONE_C_INBOUND_API_KEY>
```

или:

```http
X-Artisan-1C-Key: <ONE_C_INBOUND_API_KEY>
```

Если `ONE_C_INBOUND_API_KEY` не задан, сайт использует `ONE_C_API_KEY`.

## Проверка связи

```http
GET /api/1c
```

## Выгрузка товаров с сайта

```http
GET /api/1c/products?updatedSince=2026-05-25T00:00:00.000Z&take=500
```

Ответ содержит `sku`, цену, остаток, статус наличия, категорию и дату обновления.

## Обновление цен и остатков из 1С

```http
POST /api/1c/products
Content-Type: application/json

{
  "source": "1C Бухгалтерия 8.3",
  "products": [
    {
      "sku": "LDSP-001",
      "price": 1250,
      "compareAtPrice": 1390,
      "stockQuantity": 24,
      "inventoryStatus": "IN_STOCK",
      "status": "ACTIVE"
    }
  ]
}
```

Товар ищется по `sku`. Если товар не найден, он пропускается и возвращается в `missingSkus`.

## Забор заказов в 1С

```http
GET /api/1c/orders?status=NEW&updatedSince=2026-05-25T00:00:00.000Z&take=200
```

В заказе передаются суммы:

- `subtotal` - сумма товаров до скидок;
- `discountTotal` - общая скидка;
- `promotionDiscountTotal` - скидка по акции или промокоду;
- `loyaltyRedemptionTotal` - списание бонусов;
- `deliveryTotal` - доставка;
- `total` - финальная сумма к оплате.

Для бухгалтерского учета бонусы лучше отражать отдельной скидкой/маркетинговым списанием, а не обычной денежной оплатой.

## Обновление статуса заказа из 1С

```http
POST /api/1c/orders/statuses
Content-Type: application/json

{
  "source": "1C Бухгалтерия 8.3",
  "orders": [
    {
      "number": "A-20260525-1234",
      "status": "CONFIRMED",
      "oneCNumber": "0000-000123",
      "paidTotal": 4500,
      "comment": "Оплата прошла в 1С"
    }
  ]
}
```

Допустимые статусы заказа: `NEW`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP`, `SHIPPED`, `COMPLETED`, `CANCELED`.

## Бонусы

Получить баланс клиента:

```http
GET /api/1c/loyalty?phone=996555123456
```

Передать корректировку бонусов из 1С:

```http
POST /api/1c/loyalty
Content-Type: application/json

{
  "source": "1C Бухгалтерия 8.3",
  "operations": [
    {
      "phone": "996555123456",
      "pointsDelta": 250,
      "title": "Начисление из 1С",
      "externalId": "1C-BONUS-000123"
    }
  ]
}
```

Отрицательный `pointsDelta` списывает бонусы, положительный начисляет.
