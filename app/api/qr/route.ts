import QRCode from "qrcode";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function clampNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = url.searchParams.get("data")?.trim() ?? "";

  if (!data || data.length > 512) {
    return new NextResponse("QR data is required", { status: 400 });
  }

  const size = clampNumber(url.searchParams.get("size"), 220, 64, 640);
  const margin = clampNumber(url.searchParams.get("margin"), 2, 0, 8);
  const svg = await QRCode.toString(data, {
    type: "svg",
    width: size,
    margin,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
