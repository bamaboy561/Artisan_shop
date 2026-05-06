import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

type UploadBlockProps = {
  title?: string;
  description?: string;
  className?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
};

export function UploadBlock({
  title = "Загрузка файлов",
  description = "Перетащите PDF, Excel или чертеж. До 25 МБ.",
  className,
  name = "file",
  accept,
  multiple = false,
  required = false,
}: UploadBlockProps) {
  return (
    <label
      className={cn(
        "group block cursor-pointer border border-dashed border-[color:var(--line-strong)] bg-[var(--surface)] p-4 transition duration-300 hover:border-[color:var(--foreground)] hover:bg-white sm:p-5",
        className,
      )}
    >
      <input
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        className="sr-only"
      />
      <div className="flex items-start gap-3">
        <span className="border border-[color:var(--line)] bg-white p-2 text-[var(--accent)] transition group-hover:border-[color:var(--foreground)]">
          <Upload className="size-4" />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-[var(--foreground)]">
            {title}
          </span>
          <span className="block text-xs leading-5 text-[var(--muted)]">
            {description}
          </span>
        </span>
      </div>
    </label>
  );
}
