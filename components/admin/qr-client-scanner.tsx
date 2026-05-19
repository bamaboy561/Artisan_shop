"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Keyboard, ScanLine, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type QrClientScannerProps = {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => boolean;
};

type ScannerStatus = "idle" | "starting" | "scanning" | "found" | "error";

type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
};

type CameraSettings = MediaTrackSettings & {
  zoom?: number;
};

type CameraConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string;
  zoom?: number;
};

export function QrClientScanner({
  open,
  onClose,
  onScan,
}: QrClientScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScannedRef = useRef("");
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [focusSupported, setFocusSupported] = useState(false);
  const [zoomControl, setZoomControl] = useState<{
    min: number;
    max: number;
    step: number;
    value: number;
  } | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  async function applyCameraConstraints(constraints: CameraConstraintSet) {
    const track = streamRef.current?.getVideoTracks()[0];

    if (!track) {
      return false;
    }

    try {
      await track.applyConstraints({
        advanced: [constraints],
      });
      return true;
    } catch {
      return false;
    }
  }

  async function refocusCamera() {
    const ok = await applyCameraConstraints({ focusMode: "continuous" });

    setMessage(
      ok
        ? "Автофокус обновлен. Наведите камеру на QR клиента."
        : "Камера этого устройства не дала ручную настройку фокуса.",
    );
  }

  async function updateZoom(value: number) {
    setZoomControl((current) => (current ? { ...current, value } : current));
    await applyCameraConstraints({ zoom: value });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let isStopped = false;

    function stopCamera() {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setFocusSupported(false);
      setZoomControl(null);
    }

    function scanFrame() {
      if (isStopped) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { willReadFrequently: true });

      if (
        video &&
        canvas &&
        context &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        const scannedValue = code?.data?.trim();

        if (scannedValue && scannedValue !== lastScannedRef.current) {
          lastScannedRef.current = scannedValue;

          if (onScanRef.current(scannedValue)) {
            setStatus("found");
            setMessage("Клиент найден. Можно собирать продажу.");
            stopCamera();
            return;
          }

          setMessage(
            "QR считан, но клиент не найден. Покажите QR из личного кабинета Artisan.",
          );
          window.setTimeout(() => {
            lastScannedRef.current = "";
          }, 1400);
        }
      }

      frameRef.current = requestAnimationFrame(scanFrame);
    }

    async function startCamera() {
      setStatus("starting");
      setMessage("Запрашиваем доступ к камере...");
      lastScannedRef.current = "";

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage(
          "Браузер не дал доступ к камере. Вставьте ссылку QR вручную ниже.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (isStopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack?.getCapabilities?.() as
          | CameraCapabilities
          | undefined;
        const settings = videoTrack?.getSettings?.() as
          | CameraSettings
          | undefined;

        if (capabilities?.focusMode?.includes("continuous")) {
          setFocusSupported(true);
          try {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: "continuous" } as CameraConstraintSet],
            });
          } catch {
            // Some tablet browsers report focus support but reject the constraint.
          }
        }

        if (capabilities?.zoom) {
          const min = capabilities.zoom.min ?? 1;
          const max = capabilities.zoom.max ?? min;
          const step = capabilities.zoom.step ?? 0.1;

          if (max > min) {
            setZoomControl({
              min,
              max,
              step,
              value: settings?.zoom ?? min,
            });
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus("scanning");
        setMessage("Наведите камеру на QR клиента.");
        frameRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setStatus("error");
        setMessage(
          "Не получилось открыть камеру. Проверьте разрешение браузера или вставьте ссылку QR вручную.",
        );
      }
    }

    startCamera();

    return () => {
      isStopped = true;
      stopCamera();
    };
  }, [open]);

  function submitManualValue() {
    const value = manualValue.trim();

    if (!value) {
      setMessage("Вставьте ссылку из QR или ID клиента.");
      return;
    }

    if (onScanRef.current(value)) {
      setManualValue("");
      setStatus("found");
      setMessage("Клиент найден. Можно собирать продажу.");
      return;
    }

    setStatus("error");
    setMessage("Клиент по этому QR не найден.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сканер QR клиента"
      description="Сканируйте QR из личного кабинета клиента прямо с планшета менеджера."
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Камера работает на HTTPS и localhost. Если браузер спросит доступ,
            нажмите “Разрешить”.
          </p>
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[#111111]">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
            <div className="relative aspect-square w-full max-w-[18rem] rounded-[28px] border-2 border-white/80">
              <span className="absolute top-1/2 right-4 left-4 h-px -translate-y-1/2 bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.72)]" />
              <ScanLine className="absolute top-4 left-4 size-5 text-white/80" />
              <ScanLine className="absolute right-4 bottom-4 size-5 rotate-180 text-white/80" />
            </div>
          </div>

          <div className="absolute right-3 bottom-3 left-3">
            <div
              className={cn(
                "rounded-2xl border px-3 py-2 text-sm leading-5 backdrop-blur",
                status === "found"
                  ? "border-emerald-300/30 bg-emerald-400/18 text-emerald-50"
                  : status === "error"
                    ? "border-red-300/30 bg-red-400/18 text-red-50"
                    : "border-white/18 bg-black/44 text-white",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Camera className="size-4" />
                {message || "Готовим камеру..."}
              </span>
            </div>
          </div>
        </div>

        {focusSupported || zoomControl ? (
          <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <SlidersHorizontal className="size-4" />
              Настройка камеры для планшета
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              {focusSupported ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={refocusCamera}
                >
                  Обновить фокус
                </Button>
              ) : null}
              {zoomControl ? (
                <label className="grid gap-1 text-xs text-[var(--muted)]">
                  Приближение камеры
                  <input
                    type="range"
                    min={zoomControl.min}
                    max={zoomControl.max}
                    step={zoomControl.step}
                    value={zoomControl.value}
                    onChange={(event) => updateZoom(Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <Keyboard className="size-4" />
            Если камера не открылась, вставьте ссылку из QR вручную.
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
            <Input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="https://artisan.shop.kg/client-qr/..."
            />
            <Button type="button" variant="primary" onClick={submitManualValue}>
              Проверить
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
