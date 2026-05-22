# Production database migration

Этот документ нужен, когда текущая production-база уперлась в лимиты или ее нужно заменить без хаоса в Vercel.

## Рекомендуемая схема

- `DATABASE_URL` — runtime-подключение сайта на Vercel.
- `DIRECT_URL` — подключение для Prisma CLI: `prisma db push`, bootstrap, будущие миграции и служебные операции.

Для serverless-окружения Vercel лучше использовать pooled/runtime URL там, где его дает провайдер базы. Для Prisma-команд лучше использовать direct/session URL.

## Новый PostgreSQL

Подойдут:

- Supabase Postgres: удобно быстро подключить, есть pooler и direct/session URL.
- Любой managed PostgreSQL с нормальным лимитом трафика.
- VPS + Docker PostgreSQL, если хотим полностью контролировать сервер.

Для Supabase:

- `DATABASE_URL`: Transaction pooler URL, порт `6543`, с параметром `pgbouncer=true`, если используется transaction pooler.
- `DIRECT_URL`: Session pooler URL, порт `5432`, или direct URL, если окружение поддерживает IPv6/IPv4 add-on.

## Переключение Vercel

1. Добавить новый runtime URL:

```bash
vercel env add DATABASE_URL production --force --value "postgresql://..." --yes
```

2. Добавить direct URL для Prisma:

```bash
vercel env add DIRECT_URL production --force --value "postgresql://..." --yes
```

3. Локально проверить новую базу:

```bash
$env:DATABASE_URL="postgresql://..."
$env:DIRECT_URL="postgresql://..."
npm run db:health:direct
```

4. Подготовить новую базу:

```bash
npm run prisma:push
npm run prisma:bootstrap
npm run db:health
```

5. Задеплоить сайт:

```bash
vercel deploy --prod -y
```

## Важное про старую базу

Если старая база уже возвращает `Your project has exceeded the data transfer quota`, экспорт данных невозможен до снятия лимита. В этом случае есть два варианта:

- временно повысить тариф/дождаться сброса лимита, сделать дамп и перенести реальные товары;
- запустить новую чистую базу, создать админа и заново импортировать товары из Excel.

Для Artisan сейчас безопаснее второй вариант, если нужно быстро восстановить админку и продолжить наполнение.
