"use client";

import { useActionState } from "react";

import {
  submitServiceRequestAction,
  type ServiceRequestFormState,
} from "@/app/(public)/services/actions";
import { Button } from "@/components/ui/button";
import { FormBlock } from "@/components/ui/form-block";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UploadBlock } from "@/components/ui/upload-block";

const initialState: ServiceRequestFormState = {};

export function ServiceRequestForm() {
  const [state, formAction, pending] = useActionState(
    submitServiceRequestAction,
    initialState,
  );

  return (
    <FormBlock
      eyebrow="Заявка"
      title="Отправьте файл проекта."
      description="PDF, Excel или чертеж попадут в заявку вместе с материалом и контактами."
      actions={
        <Button
          type="submit"
          form="service-request-form"
          variant="accent"
          className="w-full sm:w-auto"
          disabled={pending}
        >
          {pending ? "Отправляем..." : "Отправить заявку"}
        </Button>
      }
    >
      <form
        id="service-request-form"
        action={formAction}
        className="grid gap-4"
      >
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Input name="contactName" placeholder="Ваше имя" required />
          <Input
            name="contactPhone"
            placeholder="Телефон"
            type="tel"
            required
          />
          <Input
            name="contactEmail"
            placeholder="Email, если нужен ответ письмом"
            type="email"
          />
          <Select name="messengerType" defaultValue="">
            <option value="">Мессенджер</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="PHONE">Только звонок</option>
          </Select>
          <Input
            name="messengerHandle"
            placeholder="@telegram или номер WhatsApp"
          />
          <Select name="material" defaultValue="" required>
            <option value="" disabled>
              Материал
            </option>
            <option value="ЛДСП">ЛДСП</option>
            <option value="МДФ">МДФ</option>
            <option value="Столешница">Столешница</option>
            <option value="Уточнить с менеджером">Уточнить с менеджером</option>
          </Select>
          <Select name="edgeOption" defaultValue="">
            <option value="">Кромка 1 мм</option>
            <option value="Без кромки">Без кромки</option>
            <option value="Кромка 1 мм">1 мм</option>
            <option value="Уточнить">Уточнить</option>
          </Select>
          <Input name="addressText" placeholder="Адрес доставки, если нужен" />
        </div>

        <Textarea
          name="comment"
          className="min-h-28 sm:min-h-32"
          placeholder="Опишите сроки, формат листа, важные детали или просто оставьте комментарий для менеджера"
        />

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <UploadBlock
            name="files"
            multiple
            accept=".pdf,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip,.rar,.jpg,.jpeg,.png,.webp,.dwg,.dxf"
            title="Загрузите PDF, Excel или чертеж"
            description="До 5 файлов, до 25 МБ каждый. Файлы сразу прикрепятся к заявке."
          />
          <div className="border border-[color:var(--line)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Приоритет
            </p>
            <RadioGroup
              className="mt-3"
              name="priority"
              defaultValue="standard"
              options={[
                {
                  value: "standard",
                  label: "Стандартная очередь",
                  description: "Обычный срок обработки.",
                },
                {
                  value: "urgent",
                  label: "Срочная обработка",
                  description:
                    "Заявка будет отмечена как срочная для менеджера.",
                },
              ]}
            />
          </div>
        </div>

        {state.message ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </FormBlock>
  );
}
