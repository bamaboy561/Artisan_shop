"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  BrandCard,
  CategoryCard,
  ProductCard,
  ServiceCard,
} from "@/components/ui/cards";
import { Checkbox } from "@/components/ui/checkbox";
import { CtaBlock } from "@/components/ui/cta-block";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBlock } from "@/components/ui/form-block";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UploadBlock } from "@/components/ui/upload-block";
import { brandNames } from "@/features/catalog/data";

const showcaseProduct = {
  slug: "demo-product",
  brand: "Artisan",
  name: "Демонстрационная карточка",
  summary: "Пример отображения товара в UI-ките.",
  format: "2800 x 2070 мм",
  action: "Запросить цену",
  price: 4200,
  oldPrice: 5000,
  inStock: true,
  categoryName: "Мебельные панели",
};

const showcaseCategory = {
  slug: "ldsp",
  indicator: "Образец",
  name: "Мебельные панели",
  summary: "Пример отображения карточки раздела.",
  scenario: "Подбор и запрос цены",
};

const tableColumns = [
  { key: "order", label: "Заказ" },
  { key: "client", label: "Клиент" },
  { key: "status", label: "Статус" },
  { key: "updated", label: "Обновлен" },
];

const tableRows = [
  {
    order: "#A-2204",
    client: "Interior Lab",
    status: (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
        В работе
      </span>
    ),
    updated: "Сегодня, 11:40",
  },
  {
    order: "#A-2203",
    client: "Wardrobe Studio",
    status: (
      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
        Ожидает файл
      </span>
    ),
    updated: "Сегодня, 09:15",
  },
  {
    order: "#A-2202",
    client: "City Joinery",
    status: (
      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
        Завершено
      </span>
    ),
    updated: "Вчера",
  },
];

export function UiKitShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMessenger, setSelectedMessenger] = useState("whatsapp");

  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Типографика
        </h2>
        <div className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/80 p-6">
          <h1 className="font-display text-5xl text-[var(--foreground)]">
            H1 Главный заголовок
          </h1>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
            H2 Заголовок секции
          </h2>
          <h3 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
            H3 Заголовок блока
          </h3>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
            Основной текст для описания товаров, услуг и интерфейсных подсказок.
            Межстрочный интервал настроен для комфортного чтения на десктопе и
            мобильных устройствах.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Подпись / вспомогательный текст
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Кнопки
        </h2>
        <div className="surface-glow flex flex-wrap gap-3 rounded-[28px] border border-[color:var(--line)] bg-white/80 p-6">
          <Button variant="primary">Основной CTA</Button>
          <Button variant="accent">Акцентный CTA</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Призрачная</Button>
          <Button disabled>Отключена</Button>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Формы
        </h2>
        <FormBlock
          eyebrow="Блок формы"
          title="Запрос консультации"
          description="Коммерческая форма со всеми базовыми полями и состояниями."
          actions={
            <div className="flex flex-wrap gap-3">
              <Button variant="accent">Отправить</Button>
              <Button variant="secondary">Сохранить</Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Имя" />
            <Input type="tel" placeholder="Телефон" />
            <Select defaultValue="">
              <option value="" disabled>
                Выберите материал
              </option>
              <option value="ldsp">ЛДСП</option>
              <option value="mdf">МДФ</option>
              <option value="worktops">Столешницы</option>
            </Select>
            <Select defaultValue="">
              <option value="" disabled>
                Вариант кромки
              </option>
              <option value="0.4">0.4 мм</option>
              <option value="1">1 мм</option>
              <option value="2">2 мм</option>
            </Select>
          </div>
          <Textarea
            className="mt-4 min-h-32"
            placeholder="Комментарий по проекту, размеры или особые условия"
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <UploadBlock />
            <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Канал связи
              </p>
              <RadioGroup
                className="mt-3"
                name="messenger-channel"
                value={selectedMessenger}
                onValueChange={setSelectedMessenger}
                options={[
                  {
                    value: "whatsapp",
                    label: "WhatsApp",
                    description: "Быстрый ответ для срочных запросов",
                  },
                  {
                    value: "telegram",
                    label: "Telegram",
                    description: "Удобно для заявок с файлами",
                  },
                ]}
              />
              <div className="mt-2">
                <Checkbox
                  label="Нужна координация доставки"
                  description="Менеджер подготовит маршрут и время"
                />
              </div>
            </div>
          </div>
        </FormBlock>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Интерактивные компоненты
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-glow space-y-4 rounded-[28px] border border-[color:var(--line)] bg-white/80 p-6">
            <Dropdown
              label="Сортировка"
              items={[
                {
                  id: "stock",
                  label: "По наличию",
                  description: "Сначала товары в активном остатке",
                },
                {
                  id: "price",
                  label: "По цене",
                  description: "От меньшей к большей",
                },
                {
                  id: "newest",
                  label: "Сначала новые",
                  description: "Сначала недавно добавленные",
                },
              ]}
            />
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Открыть модальное окно
            </Button>
          </div>
          <Tabs
            tabs={[
              {
                id: "catalog",
                label: "Каталог",
                content: (
                  <p className="text-sm leading-7 text-[var(--muted)]">
                    Список товаров с фильтрами, сортировкой и целевыми
                    коммерческими действиями.
                  </p>
                ),
              },
              {
                id: "services",
                label: "Услуги",
                content: (
                  <p className="text-sm leading-7 text-[var(--muted)]">
                    Сценарий сложной услуги с загрузкой файлов и комментариями
                    менеджера.
                  </p>
                ),
              },
              {
                id: "account",
                label: "Кабинет",
                content: (
                  <p className="text-sm leading-7 text-[var(--muted)]">
                    История заказов, заявки и избранное для постоянных клиентов.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Таблица и пагинация
        </h2>
        <DataTable
          columns={tableColumns}
          rows={tableRows}
          caption="Таблица заказов"
        />
        <Pagination currentPage={2} totalPages={5} />
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Коммерческие карточки
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProductCard
            href={`/product/${showcaseProduct.slug}`}
            brand={showcaseProduct.brand}
            name={showcaseProduct.name}
            summary={showcaseProduct.summary}
            format={showcaseProduct.format}
            action={showcaseProduct.action}
            price={showcaseProduct.price}
            oldPrice={showcaseProduct.oldPrice}
            inStock={showcaseProduct.inStock}
            categoryName={showcaseProduct.categoryName}
          />
          <CategoryCard
            href={`/catalog/${showcaseCategory.slug}`}
            indicator={showcaseCategory.indicator}
            name={showcaseCategory.name}
            summary={showcaseCategory.summary}
            scenario={showcaseCategory.scenario}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ServiceCard
            name="Распил по картам"
            detail="Загрузка карты, параметры допусков и готовая карточка задачи в производство."
          />
          <ServiceCard
            name="Кромление"
            detail="Выбор типа кромки и толщины прямо в форме заявки."
          />
          <BrandCard brand={brandNames[0]} />
        </div>
      </section>

      <CtaBlock
        eyebrow="CTA блок"
        title="Дизайн-система Artisan для каталога, услуг и коммерческих сценариев."
        description="Блок переиспользуется на страницах, в промо-кампаниях и точках конверсии категории."
        primaryCta={{ href: "/catalog", label: "Открыть каталог" }}
        secondaryCta={{ href: "/contacts", label: "Связаться с менеджером" }}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Модальное окно"
        description="Используется для подтверждения действий, быстрого заказа и обновления статусов."
        footer={
          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={() => setModalOpen(false)}>
              Подтвердить
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-7 text-[var(--muted)]">
          Модальное окно концентрирует внимание на одном действии и сохраняет
          единую визуальную систему интерфейса.
        </p>
      </Modal>
    </div>
  );
}
