"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, QrCode, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProductionQrSearchProps = {
  initialQuery?: string;
};

function getRequestIdFromQr(value: string) {
  const normalized = value.trim();

  try {
    const url = new URL(normalized, window.location.origin);
    const match = url.pathname.match(
      /^\/admin\/(?:production|requests)\/([^/]+)(?:\/route-sheet)?\/?$/,
    );

    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // The value can be a request number rather than a URL.
  }

  if (/^c[a-z0-9]{20,}$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

export function ProductionQrSearch({
  initialQuery = "",
}: ProductionQrSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scannerActive, setScannerActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerActive(false);
  }

  function openValue(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      setMessage("Введите номер заявки или отсканируйте QR.");
      return;
    }

    const requestId = getRequestIdFromQr(normalized);
    stopScanner();

    if (requestId) {
      router.push(`/admin/production/${encodeURIComponent(requestId)}`);
      return;
    }

    setQuery(normalized);
    router.push(`/admin/production?q=${encodeURIComponent(normalized)}`);
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "Камера недоступна в этом браузере. Введите номер заявки вручную.",
      );
      return;
    }

    try {
      scanHandledRef.current = false;
      setScannerActive(true);
      setMessage("Наведите заднюю камеру на QR маршрутного листа.");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        },
        videoRef.current ?? undefined,
        (result, _error, scannerControls) => {
          const value = result?.getText();

          if (value && !scanHandledRef.current) {
            scanHandledRef.current = true;
            scannerControls.stop();
            openValue(value);
          }
        },
      );

      scannerControlsRef.current = controls;
    } catch (error) {
      const isDenied =
        error instanceof DOMException && error.name === "NotAllowedError";
      setMessage(
        isDenied
          ? "Доступ к камере запрещен. Разрешите камеру в настройках браузера."
          : "Не удалось открыть камеру. Проверьте доступ и повторите попытку.",
      );
      stopScanner();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openValue(query);
  }

  useEffect(() => {
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, []);

  return (
    <section className="border border-[color:var(--line)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <QrCode className="size-5 text-[var(--accent)]" />
            Поиск производственного заказа
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Отсканируйте маршрутный лист или найдите заявку вручную.
          </p>
        </div>
        <Button
          type="button"
          variant={scannerActive ? "secondary" : "accent"}
          onClick={scannerActive ? stopScanner : startScanner}
        >
          {scannerActive ? (
            <X className="size-4" />
          ) : (
            <Camera className="size-4" />
          )}
          {scannerActive ? "Закрыть камеру" : "Сканировать QR"}
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер заявки, материал, клиент или телефон"
            className="pl-10"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit">Найти</Button>
      </form>

      <video
        ref={videoRef}
        playsInline
        muted
        className={cn(
          "mt-4 aspect-video max-h-[420px] w-full rounded-md bg-black object-cover",
          !scannerActive && "hidden",
        )}
      />

      {message ? (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
      ) : null}
    </section>
  );
}
