# Deploy Artisan on VPS

Этот вариант нужен для нормальной работы в сети:

- PostgreSQL хранит данные постоянно
- загруженные файлы распила сохраняются в volume
- админка и заявки работают без demo-режима

## 1. Подготовить сервер

Нужны:

- Linux VPS
- Docker
- Docker Compose
- домен и reverse proxy по желанию

## 2. Забрать проект

```bash
git clone https://github.com/bamaboy561/Artisan_shop.git artisan-shop
cd artisan-shop
```

## 3. Создать production env

```bash
cp .env.production.example .env.production
```

Обязательно поменяйте:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SESSION_SECRET`

Если Telegram нужен сразу, заполните и Telegram-переменные.

## 4. Поднять контейнеры

```bash
docker compose --env-file .env.production up -d --build
```

## 5. Применить схему Prisma

```bash
docker compose --env-file .env.production exec app npm run prisma:push
```

## 6. Заполнить стартовые данные

```bash
docker compose --env-file .env.production exec app npm run prisma:seed
```

## 7. Проверить сайт

- сайт: `http://SERVER_IP:3000`
- вход: `http://SERVER_IP:3000/login`

После `seed` можно использовать:

- `admin@artisan.local`
- `Artisan123!`

## 8. Что хранится постоянно

- PostgreSQL: volume `artisan_postgres`
- служебные runtime-файлы: volume `artisan_runtime`
- загрузки клиентов: volume `artisan_uploads`

## 9. Обновление проекта

```bash
git pull
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production exec app npm run prisma:push
```

## 10. Когда лучше не использовать demo-режим

Для боевой работы всегда используйте:

```env
ARTISAN_DEMO_MODE=false
```

Demo-режим подходит только для временной демонстрации интерфейса.
