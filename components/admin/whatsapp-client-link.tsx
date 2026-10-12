import { MessageCircle } from "lucide-react";

import { buildWhatsappHref } from "@/features/admin/whatsapp";
import { cn } from "@/lib/utils";

type WhatsappClientLinkProps = {
  phone: string | null | undefined;
  text: string;
  label?: string;
  className?: string;
};

export function WhatsappClientLink({
  phone,
  text,
  label = "Написать в WhatsApp",
  className,
}: WhatsappClientLinkProps) {
  const href = buildWhatsappHref(phone, text);

  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 underline-offset-4 hover:underline",
        className,
      )}
    >
      <MessageCircle className="size-4" strokeWidth={1.9} />
      {label}
    </a>
  );
}
