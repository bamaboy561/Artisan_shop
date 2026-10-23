"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  FileUp,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  createAdminCuttingRequestAction,
  type AdminCuttingRequestFormState,
} from "@/app/admin/actions";
import { BazisFilePreview } from "@/components/bazis/bazis-file-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { withBazisAccept } from "@/lib/bazis-file";

type CustomerOption = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
};

type CuttingRequestFormProps = {
  customers: CustomerOption[];
};

const initialState: AdminCuttingRequestFormState = {};

function getCustomerName(customer: CustomerOption) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.companyName ||
    customer.email
  );
}

function mergeCustomers(
  incoming: CustomerOption[],
  current: CustomerOption[],
  selectedCustomerId: string,
) {
  const merged = new Map(incoming.map((customer) => [customer.id, customer]));
  const selected = current.find(
    (customer) => customer.id === selectedCustomerId,
  );

  if (selected) {
    merged.set(selected.id, selected);
  }

  return Array.from(merged.values());
}

async function fetchCustomers(query: string, signal: AbortSignal) {
  const response = await fetch(
    `/api/admin/customers?q=${encodeURIComponent(query)}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Customer search failed");
  }

  const payload = (await response.json()) as { customers?: CustomerOption[] };
  return Array.isArray(payload.customers) ? payload.customers : [];
}

export function CuttingRequestForm({ customers }: CuttingRequestFormProps) {
  const [state, formAction, pending] = useActionState(
    createAdminCuttingRequestAction,
    initialState,
  );
  const [mode, setMode] = useState<"existing" | "manual">("existing");
  const [options, setOptions] = useState(customers);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [bazisFile, setBazisFile] = useState<File | null>(null);

  const selectedCustomer = useMemo(
    () => options.find((customer) => customer.id === selectedCustomerId),
    [options, selectedCustomerId],
  );
  // Показываем всех найденных: список прокручивается.
  const customerResults = options;

  useEffect(() => {
    if (mode !== "existing") {
      return;
    }

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);

      try {
        const nextCustomers = await fetchCustomers(
          normalizedQuery,
          controller.signal,
        );
        setOptions((current) =>
          mergeCustomers(nextCustomers, current, selectedCustomerId),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSearchError("Не удалось загрузить клиентов.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [customers, mode, query, selectedCustomerId]);

  function selectCustomer(customer: CustomerOption) {
    setSelectedCustomerId(customer.id);
    setContactName(getCustomerName(customer));
    setContactPhone(customer.phone ?? "");
    setContactEmail(customer.email);
    setQuery("");
  }

  function updateQuery(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setOptions((current) =>
        mergeCustomers(customers, current, selectedCustomerId),
      );
      setSearchError(null);
    }
  }

  function switchMode(nextMode: "existing" | "manual") {
    setMode(nextMode);
    setQuery("");
    setSelectedCustomerId("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setSearchError(null);
  }

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-2">
      <input
        type="hidden"
        name="customerId"
        value={mode === "existing" ? selectedCustomerId : ""}
      />

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center bg-[var(--foreground)] text-white">
            <UserRound className="size-4.5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
              Клиент
            </p>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Контакт для заказа
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 border border-[color:var(--line)] bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={() => switchMode("existing")}
            className={cn(
              "h-9 px-3 text-xs font-semibold transition",
              mode === "existing"
                ? "bg-[var(--foreground)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            Из базы
          </button>
          <button
            type="button"
            onClick={() => switchMode("manual")}
            className={cn(
              "h-9 px-3 text-xs font-semibold transition",
              mode === "manual"
                ? "bg-[var(--foreground)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            Без аккаунта
          </button>
        </div>

        {mode === "existing" ? (
          <div className="mt-4 space-y-3">
            <label className="grid gap-2 text-sm font-medium">
              Поиск клиента
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder="Имя, телефон, компания или email"
                  className="pl-10"
                />
                {loading ? (
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--muted)]">
                    Поиск...
                  </span>
                ) : null}
              </span>
            </label>

            {searchError ? (
              <p className="text-xs text-[#b42318]">{searchError}</p>
            ) : null}

            {selectedCustomer ? (
              <div className="flex items-start justify-between gap-3 border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-emerald-900">
                    <Check className="size-4 shrink-0" />
                    {getCustomerName(selectedCustomer)}
                  </p>
                  <p className="mt-1 truncate text-xs text-emerald-800/75">
                    {selectedCustomer.phone ?? selectedCustomer.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setContactName("");
                    setContactPhone("");
                    setContactEmail("");
                  }}
                  aria-label="Снять выбор клиента"
                  title="Снять выбор клиента"
                  className="flex size-8 shrink-0 items-center justify-center text-emerald-900 transition hover:bg-emerald-100"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="grid max-h-80 gap-1 overflow-y-auto border border-[color:var(--line)] p-1">
                {customerResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="grid gap-0.5 px-3 py-2 text-left transition hover:bg-[var(--surface)]"
                  >
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {getCustomerName(customer)}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {[customer.phone, customer.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
                {!loading && customerResults.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[var(--muted)]">
                    Клиенты не найдены
                  </p>
                ) : null}
                {customerResults.length >= 100 ? (
                  <p className="px-3 py-2 text-xs text-[var(--muted)]">
                    Показаны первые 100. Введите имя или телефон, чтобы найти
                    остальных.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            Имя или компания
            <Input
              name="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Имя клиента"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Телефон
            <Input
              name="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="+996 ..."
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <Input
              name="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="client@example.com"
            />
          </label>
        </div>
      </section>

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
            <CalendarDays className="size-4.5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
              Производство
            </p>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Материал и срок
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Материалы / листы
            <Input
              name="material"
              maxLength={500}
              placeholder="Например: МДФ 18 мм, Albero A-01"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Количество листов
            <Input
              name="cuttingSheetCount"
              type="number"
              min={1}
              max={10000}
              step={1}
              inputMode="numeric"
              placeholder="Например: 12"
            />
            <span className="text-xs font-normal text-[var(--muted)]">
              Можно заполнить позже в карточке заявки.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Кромка
            <Input
              name="edgeOption"
              maxLength={240}
              placeholder="Например: 0,8 × 22 мм, белая, код 101"
            />
            <span className="text-xs font-normal text-[var(--muted)]">
              Можно указать толщину, ширину, цвет и артикул кромки.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Кромка, пог. м
            <Input
              name="cuttingEdgeMeters"
              type="number"
              min={0}
              max={100000}
              step={0.1}
              inputMode="decimal"
              placeholder="Например: 48,5"
            />
            <span className="text-xs font-normal text-[var(--muted)]">
              Общий метраж кромки по заявке.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Плановая готовность
            <Input name="deadline" type="date" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Комментарий
            <Textarea
              name="comment"
              className="min-h-28 resize-y"
              placeholder="Номер проекта Giblab, срочность или примечание"
            />
          </label>
        </div>
      </section>

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6 xl:col-span-2">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border border-[color:var(--line-strong)] bg-[var(--surface)] text-[var(--accent)]">
                <FileUp className="size-4.5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
                  Файлы
                </p>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Исходники проекта
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    необязательно
                  </span>
                </h2>
              </div>
            </div>

            <label className="mt-4 block cursor-pointer border border-dashed border-[color:var(--line-strong)] bg-[var(--surface)] p-4 transition hover:border-[color:var(--foreground)] hover:bg-white">
              <input
                type="file"
                name="files"
                multiple
                accept={withBazisAccept(
                  ".pdf,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip,.rar,.jpg,.jpeg,.png,.webp,.heic,.dwg,.dxf,.project,.b3d,.bpr,.sto,.xml",
                )}
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);

                  setFileNames(files.map((file) => file.name));
                  setBazisFile(
                    files.find((file) => /\.b3d$/i.test(file.name)) ?? null,
                  );
                }}
              />
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                {fileNames.length > 0
                  ? `Выбрано файлов: ${fileNames.length}`
                  : "Выбрать файлы, если они есть"}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                Excel, PDF, изображения, DXF, DWG, Giblab .project или архив.
                Можно добавить позже
              </span>
            </label>

            {bazisFile ? (
              <div className="mt-3">
                <BazisFilePreview file={bazisFile} />
              </div>
            ) : null}

            {fileNames.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {fileNames.slice(0, 6).map((fileName) => (
                  <span
                    key={fileName}
                    className="max-w-full truncate border border-[color:var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--muted)]"
                  >
                    {fileName}
                  </span>
                ))}
                {fileNames.length > 6 ? (
                  <span className="px-2.5 py-1 text-xs text-[var(--muted)]">
                    +{fileNames.length - 6}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:w-64">
            {state.message ? (
              <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700">
                {state.message}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Создаем..." : "Создать распил"}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}
