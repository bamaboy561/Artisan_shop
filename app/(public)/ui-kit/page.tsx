import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/ui/section-intro";
import { UiKitShowcase } from "@/features/ui/ui-kit-showcase";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "UI-кит Artisan",
  robots: noIndexRobots,
};

export default function UiKitPage() {
  return (
    <div className="py-14 sm:py-18">
      <Container className="space-y-10">
        <SectionIntro
          eyebrow="UI-кит"
          title="Визуальная система Artisan для публичных страниц, кабинета и админки."
          description="Включает базовые контролы, коммерческие карточки, паттерны таблиц/пагинации и интерактивные компоненты."
          className="reveal-up"
        />
        <UiKitShowcase />
      </Container>
    </div>
  );
}
