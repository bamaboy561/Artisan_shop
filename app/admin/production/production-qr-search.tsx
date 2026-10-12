"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, RefreshCw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProductionQrSearchProps = {
  initialQuery?: string;
  queueUrl?: string;
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
  queueUrl = "/admin/production",
}: ProductionQrSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scannerActive, setScannerActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const scanGeneration = useRef(0);

  function stopScanner() {
    scanGeneration.current += 1;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerActive(false);
  }

  function openValue(value: string) {
    const normalized = value.trim();

    const requestId = getRequestIdFromQr(normalized);
    stopScanner();

    if (requestId) {
      router.push(
        `/admin/production/${encodeURIComponent(requestId)}?${new URLSearchParams({ returnTo: queueUrl })}`,
      );
      return;
    }

    setQuery(normalized);
    const url = new URL(queueUrl, window.location.origin);
    if (normalized) url.searchParams.set("q", normalized);
    else url.searchParams.delete("q");
    url.searchParams.delete("page");
    router.push(`${url.pathname}${url.search}`);
  }

  async function startScanner() {
    const generation = ++scanGeneration.current;
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

          if (
            value &&
            generation === scanGeneration.current &&
            !scanHandledRef.current
          ) {
            scanHandledRef.current = true;
            scannerControls.stop();
            openValue(value);
          }
        },
      );

      if (generation !== scanGeneration.current || scanHandledRef.current)
        controls.stop();
      else scannerControlsRef.current = controls;
    } catch (error) {
      if (generation !== scanGeneration.current) return;
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
      scanGeneration.current += 1;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, []);

  return (
    <section className="border-y border-[color:var(--line)] bg-white py-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-[1_1_320px] gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              aria-label="Поиск заказа, клиента или материала"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Заказ, клиент, материал, телефон"
              className="h-11 min-w-0 rounded pl-10 text-sm sm:pl-10"
              enterKeyHint="search"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            aria-label="Найти"
            title="Найти"
            className="h-11 w-11 shrink-0 rounded p-0"
          >
            <Search size={18} />
          </Button>
        </form>
        <Button
          type="button"
          variant={scannerActive ? "secondary" : "accent"}
          onClick={scannerActive ? stopScanner : startScanner}
          className="min-h-11 rounded"
        >
          {scannerActive ? (
            <X className="size-4" />
          ) : (
            <Camera className="size-4" />
          )}
          {scannerActive ? "Закрыть камеру" : "Сканировать QR"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить очередь"
          title="Обновить очередь"
          disabled={refreshing}
          onClick={() => startRefresh(() => router.refresh())}
          className="h-11 w-11 rounded p-0"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
      </div>

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
        <p role="status" className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
