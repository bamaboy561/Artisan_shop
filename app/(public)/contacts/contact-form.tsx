"use client";

import { useActionState } from "react";

import {
  submitContactForm,
  type ContactFormState,
} from "@/app/auth/contact-actions";
import { Button } from "@/components/ui/button";
import { FormBlock } from "@/components/ui/form-block";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const initialState: ContactFormState = {};

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitContactForm,
    initialState,
  );

  if (state.success) {
    return (
      <FormBlock
        eyebrow="Готово"
        title="Заявка отправлена."
        description="Свяжемся с вами в ближайшее время."
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-800">
          {state.message}
        </div>
      </FormBlock>
    );
  }

  return (
    <FormBlock
      eyebrow="Контакты"
      title="Напишите задачу."
      description="Подберем материал, рассчитаем распил или ответим по проекту."
    >
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="name" placeholder="Ваше имя" required />
          <Input name="phone" type="tel" placeholder="Телефон" required />
        </div>
        <Input name="email" type="email" placeholder="Email, если удобно" />
        <Textarea
          name="message"
          className="min-h-36"
          placeholder="Опишите ваш запрос"
          required
        />
        {state.message ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Отправляем..." : "Отправить заявку"}
          </Button>
        </div>
      </form>
    </FormBlock>
  );
}
