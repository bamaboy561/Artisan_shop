import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import type { PromoMagazineData } from "@/lib/server/promo-magazine-data";
import { catalogThumbnail } from "@/lib/server/catalog-thumbnail";

type Doc = InstanceType<typeof PDFDocument>;
type MagazineProduct = PromoMagazineData["products"][number];

const PAGE = { width: 595.28, height: 841.89, margin: 26 };
const C = {
  ink: "#17130f",
  muted: "#77706a",
  line: "#ece6de",
  paper: "#ffffff",
  warm: "#f6f1ea",
  green: "#1d7a4f",
};

// Темы журнала: обычная «гипермаркет» и новогодняя. Тема хранится на
// документе, чтобы параллельные выгрузки с разными темами не мешали друг другу.
export type MagazineThemeId = "classic" | "new-year";
type MagazineTheme = {
  id: MagazineThemeId;
  sale: string; // цена, звёзды скидки, метки
  saleDeep: string; // тень ценника
  tag: string; // ценник
  bg: string; // обложка, шапка страниц, баннер
  bgDeep: string;
  bgDark: string; // низ обложки
  accent: string; // акцентный текст и полосы на фоне
  wedge: string; // клин на обложке под товарами
  wedgeText: string;
  soft: string; // мелкий светлый текст на фоне
};
const THEMES: Record<MagazineThemeId, MagazineTheme> = {
  classic: {
    id: "classic",
    sale: "#e3001b",
    saleDeep: "#a80014",
    tag: "#ffd400",
    bg: "#e3001b",
    bgDeep: "#a80014",
    bgDark: "#7d000f",
    accent: "#ffd400",
    wedge: "#ffd400",
    wedgeText: "#e3001b",
    soft: "#ffd9dd",
  },
  "new-year": {
    id: "new-year",
    sale: "#d0102b",
    saleDeep: "#7e0a1c",
    tag: "#f6c945",
    bg: "#0f4d37",
    bgDeep: "#0a3a29",
    bgDark: "#072a1d",
    accent: "#f6c945",
    wedge: "#c8102e",
    wedgeText: "#ffffff",
    soft: "#cfe6da",
  },
};
const docThemes = new WeakMap<Doc, MagazineTheme>();
function T(doc: Doc) {
  return docThemes.get(doc) ?? THEMES.classic;
}

// Новогодняя тема включается сама с 1 декабря по 15 января (Бишкек).
export function defaultMagazineTheme(date = new Date()): MagazineThemeId {
  const { month, day } = bishkekParts(date);
  return month === 11 || (month === 0 && day <= 15) ? "new-year" : "classic";
}

export function parseMagazineTheme(value: string | null | undefined) {
  return value === "new-year" || value === "classic" ? value : null;
}

// Снежинка: шесть лучей с веточками.
function drawSnowflake(
  doc: Doc,
  cx: number,
  cy: number,
  r: number,
  color = "#ffffff",
  opacity = 1,
) {
  doc.save();
  doc
    .opacity(opacity)
    .strokeColor(color)
    .lineWidth(Math.max(0.6, r / 9))
    .lineCap("round");
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r;
    doc.moveTo(cx, cy).lineTo(ex, ey).stroke();
    const bx = cx + Math.cos(a) * r * 0.55;
    const by = cy + Math.sin(a) * r * 0.55;
    for (const side of [-1, 1]) {
      const ba = a + side * 0.7;
      doc
        .moveTo(bx, by)
        .lineTo(bx + Math.cos(ba) * r * 0.35, by + Math.sin(ba) * r * 0.35)
        .stroke();
    }
  }
  doc.restore();
}

// Падающий снег: детерминированный, чтобы журнал выглядел одинаково.
function drawSnow(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  seed = 7,
) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    const px = x + rand() * width;
    const py = y + rand() * height;
    const kind = rand();
    if (kind > 0.82)
      drawSnowflake(doc, px, py, 5 + rand() * 9, "#ffffff", 0.55);
    else {
      doc.save();
      doc
        .opacity(0.35 + rand() * 0.4)
        .circle(px, py, 0.8 + rand() * 1.8)
        .fill("#ffffff");
      doc.restore();
    }
  }
}

// Гирлянда: провисающий провод и цветные лампочки.
function drawGarland(doc: Doc, y: number, sag: number, width: number) {
  const colors = [
    "#f6c945",
    "#d0102b",
    "#ffffff",
    "#3fbf7f",
    "#f6c945",
    "#ff7a59",
  ];
  const spans = 4;
  const spanWidth = width / spans;
  doc.save();
  doc.strokeColor("#0a2a1d").lineWidth(1.2);
  for (let i = 0; i < spans; i++) {
    const x0 = i * spanWidth;
    doc
      .moveTo(x0, y)
      .quadraticCurveTo(x0 + spanWidth / 2, y + sag * 2, x0 + spanWidth, y)
      .stroke();
  }
  let bulb = 0;
  for (let i = 0; i < spans; i++) {
    const x0 = i * spanWidth;
    for (let k = 1; k < 7; k++) {
      const t = k / 7;
      const bx = x0 + spanWidth * t;
      const by = y + sag * 4 * t * (1 - t);
      const color = colors[bulb++ % colors.length];
      doc.save();
      doc
        .opacity(0.28)
        .circle(bx, by + 6, 7)
        .fill(color);
      doc.restore();
      doc.rect(bx - 1.6, by - 1, 3.2, 3).fill("#0a2a1d");
      doc.ellipse(bx, by + 6, 3, 4.6).fill(color);
    }
  }
  doc.restore();
}

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function bishkekParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bishkek",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

export function magazineUntil(date: Date | null) {
  if (!date) return "Пока товар есть в наличии";
  const { day, month, year } = bishkekParts(date);
  return `Акция до ${day} ${MONTHS_GENITIVE[month]} ${year}`;
}

function shortDate(date: Date | null) {
  if (!date) return "";
  const { day, month } = bishkekParts(date);
  return `до ${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}`;
}

const money = (value: number) => value.toLocaleString("ru-RU");

// Раскладка журнала: на каждой странице одна большая «звезда» и четыре
// карточки 2×2. Звезда чередуется: фото слева, потом справа.
export const PER_PAGE = 5;
export function magazinePages(count: number) {
  return Math.max(1, Math.ceil(count / PER_PAGE));
}

export async function loadMagazinePhotos(data: PromoMagazineData) {
  const photos: (Buffer | null)[] = new Array(data.products.length).fill(null);
  const deadline = Date.now() + 90_000;
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < data.products.length) {
        const current = index++;
        if (Date.now() > deadline) return;
        const hero = current % PER_PAGE === 0;
        const product = data.products[current];
        const photo = await catalogThumbnail(
          product.imageUrl,
          hero ? [760, 640] : [560, 400],
        );
        // Образец декора заполняет всё окно фото: убираем белые поля,
        // которые миниатюра добавляет при вписывании.
        photos[current] =
          photo && product.isSheet
            ? await sharp(photo)
                .trim({ background: "#ffffff", threshold: 12 })
                .jpeg({ quality: 86 })
                .toBuffer()
                .catch(() => photo)
            : photo;
      }
    }),
  );
  return photos;
}

function drawLogoMark(doc: Doc, x: number, y: number, size: number) {
  doc.save();
  doc.rect(x, y, size, size).fill("#111210");
  doc.rect(x, y, size * 0.074, size).fill("#c76a43");
  doc.rect(x, y + size * 0.935, size, size * 0.065).fill("#ac5835");
  doc
    .font("bold")
    .fontSize(size * 0.72)
    .fillColor("#fffdf8")
    .text("A", x + size * 0.037, y + size * 0.04, {
      width: size,
      align: "center",
      lineBreak: false,
    });
  doc.restore();
}

// Звезда-ценник как в гипермаркете: зубчатый круг с процентом скидки.
function drawBurst(
  doc: Doc,
  cx: number,
  cy: number,
  radius: number,
  label: string,
  { fill = T(doc).sale, color = "#ffffff", angle = -12 } = {},
) {
  const spikes = 18;
  const points: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.84;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  doc.save();
  doc.polygon(...points).fill(fill);
  doc.rotate(angle, { origin: [cx, cy] });
  const size = radius * (label.length > 4 ? 0.52 : 0.62);
  doc
    .font("bold")
    .fontSize(size)
    .fillColor(color)
    .text(label, cx - radius, cy - size * 0.68, {
      width: radius * 2,
      align: "center",
      lineBreak: false,
    });
  doc.restore();
}

// Жёлтый ценник: старая цена зачёркнута, новая — крупно красным.
function drawPriceTag(
  doc: Doc,
  product: MagazineProduct,
  x: number,
  y: number,
  scale: number,
  maxWidth: number,
) {
  const priceSize = 22 * scale;
  const unitSize = 9 * scale;
  const padX = 8 * scale;
  const padY = 5 * scale;
  const price = money(product.price);
  doc.font("bold").fontSize(priceSize);
  const priceWidth = doc.widthOfString(price);
  doc.fontSize(unitSize);
  const unitWidth = doc.widthOfString("сом");
  const width = Math.min(
    maxWidth,
    padX * 2 + priceWidth + 3 * scale + unitWidth,
  );
  const height = priceSize * 1.05 + padY * 2;
  let tagTop = y;
  if (product.oldPrice) {
    const old = `${money(product.oldPrice)} сом`;
    doc
      .font("regular")
      .fontSize(9 * scale)
      .fillColor(C.muted);
    const oldWidth = doc.widthOfString(old);
    doc.text(old, x + 2, y, { lineBreak: false });
    doc
      .strokeColor(T(doc).sale)
      .lineWidth(1.1 * scale)
      .moveTo(x + 1, y + 6 * scale)
      .lineTo(x + oldWidth + 3, y + 5 * scale)
      .stroke();
    tagTop = y + 13 * scale;
  }
  doc.save();
  doc
    .rect(x + 2.5 * scale, tagTop + 2.5 * scale, width, height)
    .fill(T(doc).saleDeep);
  doc.rect(x, tagTop, width, height).fill(T(doc).tag);
  doc
    .font("bold")
    .fontSize(priceSize)
    .fillColor(T(doc).sale)
    .text(price, x + padX, tagTop + padY - priceSize * 0.08, {
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(unitSize)
    .fillColor(C.ink)
    .text(
      "сом",
      x + padX + priceWidth + 3 * scale,
      tagTop + padY + priceSize * 0.42,
      {
        lineBreak: false,
      },
    );
  doc.restore();
  return tagTop + height;
}

function drawPhoto(
  doc: Doc,
  photo: Buffer | null,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = false,
) {
  doc.save();
  doc.rect(x, y, width, height).fill(photo ? "#ffffff" : C.warm);
  if (photo) {
    doc.rect(x, y, width, height).clip();
    // Декор плиты — на всё окно, товар (фурнитура, интерьер) — целиком.
    if (fill)
      doc.image(photo, x, y, {
        cover: [width, height],
        align: "center",
        valign: "center",
      });
    else
      doc.image(photo, x + 8, y + 8, {
        fit: [width - 16, height - 16],
        align: "center",
        valign: "center",
      });
  } else {
    drawLogoMark(doc, x + width / 2 - 14, y + height / 2 - 26, 28);
    doc
      .font("regular")
      .fontSize(8)
      .fillColor(C.muted)
      .text(name, x + 10, y + height / 2 + 10, {
        width: width - 20,
        align: "center",
        height: 22,
        ellipsis: true,
      });
  }
  doc.restore();
}

async function qrImage(url: string) {
  return QRCode.toBuffer(url, {
    margin: 0,
    width: 120,
    errorCorrectionLevel: "L",
    color: { dark: C.ink, light: "#ffffff" },
  });
}

function drawStock(doc: Doc, inStock: boolean, x: number, y: number) {
  doc.circle(x + 2.5, y + 4, 2.5).fill(inStock ? C.green : C.muted);
  doc
    .font("regular")
    .fontSize(7.5)
    .fillColor(inStock ? C.green : C.muted)
    .text(inStock ? "В наличии" : "Под заказ", x + 8, y, { lineBreak: false });
}

async function drawCard(
  doc: Doc,
  product: MagazineProduct,
  photo: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.save();
  doc.roundedRect(x, y, width, height, 6).fill(C.paper);
  doc.roundedRect(x, y, width, height, 6).lineWidth(0.6).stroke(C.line);
  doc.roundedRect(x, y, width, height, 6).clip();
  const photoHeight = height * 0.5;
  drawPhoto(
    doc,
    photo,
    product.name,
    x,
    y,
    width,
    photoHeight,
    product.isSheet,
  );
  doc.restore();

  if (product.percent > 0)
    drawBurst(doc, x + width - 30, y + 30, 25, `−${product.percent}%`);
  const end = shortDate(product.endsAt);
  if (end) {
    doc.font("bold").fontSize(7);
    const w = doc.widthOfString(end) + 10;
    doc.rect(x, y + photoHeight - 15, w, 15).fill(C.ink);
    doc
      .fillColor("#ffffff")
      .text(end, x + 5, y + photoHeight - 11, { lineBreak: false });
  }

  const inner = x + 12;
  const innerWidth = width - 24;
  let ty = y + photoHeight + 10;
  doc
    .font("bold")
    .fontSize(7)
    .fillColor(T(doc).sale)
    .text(
      [product.brand, product.category]
        .filter(Boolean)
        .join(" · ")
        .toUpperCase(),
      inner,
      ty,
      { width: innerWidth, height: 9, ellipsis: true, characterSpacing: 0.6 },
    );
  ty += 12;
  doc.font("bold").fontSize(11).fillColor(C.ink);
  const nameOptions = {
    width: innerWidth,
    height: 28,
    ellipsis: true,
    lineGap: -1,
  };
  doc.text(product.name, inner, ty, nameOptions);
  ty += Math.min(28, doc.heightOfString(product.name, nameOptions)) + 3;
  if (product.format) {
    doc
      .font("regular")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(product.format, inner, ty, {
        width: innerWidth,
        height: 10,
        ellipsis: true,
      });
  }

  const qrSize = 34;
  const bottom = y + height - 12;
  const tagY = bottom - (product.oldPrice ? 13 : 0) - 33;
  drawPriceTag(doc, product, inner - 2, tagY, 1, innerWidth - qrSize - 8);
  doc.image(
    await qrImage(product.url),
    x + width - 12 - qrSize,
    bottom - qrSize,
    {
      width: qrSize,
    },
  );
  drawStock(
    doc,
    product.inStock,
    x + width - 12 - qrSize - 2,
    bottom - qrSize - 13,
  );
}

async function drawHero(
  doc: Doc,
  product: MagazineProduct,
  photo: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
  photoRight: boolean,
) {
  doc.save();
  doc.roundedRect(x, y, width, height, 8).fill(C.paper);
  doc.roundedRect(x, y, width, height, 8).lineWidth(0.6).stroke(C.line);
  doc.roundedRect(x, y, width, height, 8).clip();
  const photoWidth = width * 0.52;
  const photoX = photoRight ? x + width - photoWidth : x;
  drawPhoto(
    doc,
    photo,
    product.name,
    photoX,
    y,
    photoWidth,
    height,
    product.isSheet,
  );
  // Жёлтая полоса-разделитель между фото и текстом.
  doc
    .rect(photoRight ? photoX - 5 : photoX + photoWidth, y, 5, height)
    .fill(T(doc).accent);
  doc.restore();

  if (product.percent > 0)
    drawBurst(
      doc,
      photoRight ? photoX + photoWidth - 46 : photoX + 46,
      y + 46,
      40,
      `−${product.percent}%`,
      { angle: photoRight ? 10 : -12 },
    );

  const textX = photoRight ? x + 20 : photoX + photoWidth + 22;
  const textWidth = width - photoWidth - 44;
  let ty = y + 20;
  doc.font("bold").fontSize(8);
  const label = "ХИТ АКЦИИ";
  const lw = doc.widthOfString(label) + 14;
  doc.rect(textX, ty, lw, 16).fill(T(doc).sale);
  doc
    .fillColor("#ffffff")
    .text(label, textX + 7, ty + 4, { lineBreak: false, characterSpacing: 1 });
  const end = shortDate(product.endsAt);
  if (end) {
    doc
      .font("bold")
      .fontSize(8)
      .fillColor(C.ink)
      .text(end, textX + lw + 8, ty + 4, { lineBreak: false });
  }
  ty += 28;
  doc
    .font("bold")
    .fontSize(8)
    .fillColor(T(doc).sale)
    .text(
      [product.brand, product.category]
        .filter(Boolean)
        .join(" · ")
        .toUpperCase(),
      textX,
      ty,
      { width: textWidth, height: 11, ellipsis: true, characterSpacing: 0.8 },
    );
  ty += 14;
  doc.font("bold").fontSize(19).fillColor(C.ink);
  const nameOptions = {
    width: textWidth,
    height: 70,
    ellipsis: true,
    lineGap: -2,
  };
  doc.text(product.name, textX, ty, nameOptions);
  ty += Math.min(70, doc.heightOfString(product.name, nameOptions)) + 6;
  if (product.format)
    doc
      .font("regular")
      .fontSize(9)
      .fillColor(C.muted)
      .text(product.format, textX, ty, {
        width: textWidth,
        height: 24,
        ellipsis: true,
      });

  const qrSize = 46;
  const bottom = y + height - 18;
  const tagY = bottom - (product.oldPrice ? 19 : 0) - 50;
  drawPriceTag(doc, product, textX, tagY, 1.5, textWidth - qrSize - 10);
  doc.image(
    await qrImage(product.url),
    textX + textWidth - qrSize,
    bottom - qrSize,
    {
      width: qrSize,
    },
  );
  drawStock(
    doc,
    product.inStock,
    textX + textWidth - qrSize,
    bottom - qrSize - 14,
  );
}

function drawPageHeader(doc: Doc, data: PromoMagazineData) {
  doc.rect(0, 0, PAGE.width, 44).fill(T(doc).bg);
  doc.rect(0, 44, PAGE.width, 4).fill(T(doc).accent);
  if (T(doc).id === "new-year") {
    for (const [fx, fy, fr] of [
      [190, 14, 6],
      [250, 30, 4],
      [310, 12, 5],
      [360, 28, 3.5],
    ] as const)
      drawSnowflake(doc, fx, fy, fr, "#ffffff", 0.5);
  }
  drawLogoMark(doc, PAGE.margin, 10, 24);
  doc
    .font("bold")
    .fontSize(13)
    .fillColor("#ffffff")
    .text("ARTISAN", PAGE.margin + 32, 13, {
      characterSpacing: 3,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(9)
    .fillColor(T(doc).accent)
    .text("АКЦИИ", PAGE.margin + 32, 28, {
      characterSpacing: 2,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(9)
    .fillColor("#ffffff")
    .text(magazineUntil(data.endsAt).toUpperCase(), PAGE.margin, 18, {
      width: PAGE.width - PAGE.margin * 2,
      align: "right",
      characterSpacing: 1,
      lineBreak: false,
    });
}

function drawPageFooter(doc: Doc, data: PromoMagazineData, page: number) {
  const y = PAGE.height - 26;
  doc
    .strokeColor(C.line)
    .lineWidth(0.6)
    .moveTo(PAGE.margin, y - 6)
    .lineTo(PAGE.width - PAGE.margin, y - 6)
    .stroke();
  doc
    .font("regular")
    .fontSize(7.5)
    .fillColor(C.muted)
    .text(
      `${data.contacts.phone} · ${data.contacts.address} · ${data.siteUrl.replace(/^https?:\/\//, "")} · Наведите камеру на QR: товар на сайте`,
      PAGE.margin,
      y,
      {
        width: PAGE.width - PAGE.margin * 2 - 30,
        lineBreak: false,
        ellipsis: true,
      },
    );
  doc
    .font("bold")
    .fontSize(9)
    .fillColor(T(doc).sale)
    .text(String(page), PAGE.width - PAGE.margin - 30, y - 1, {
      width: 30,
      align: "right",
      lineBreak: false,
    });
}

async function drawBanner(
  doc: Doc,
  data: PromoMagazineData,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.save();
  doc.roundedRect(x, y, width, height, 8).fill(T(doc).bg);
  doc.roundedRect(x, y, width, height, 8).clip();
  doc
    .polygon(
      [x, y + height * 0.72],
      [x + width, y + height * 0.55],
      [x + width, y + height],
      [x, y + height],
    )
    .fill(T(doc).wedge);
  if (T(doc).id === "new-year")
    drawSnow(
      doc,
      x,
      y + height * 0.3,
      width,
      height * 0.3,
      Math.round(width / 18),
      11,
    );
  doc.restore();
  const wide = width > 400;
  const pad = wide ? 28 : 16;
  const qrSize = Math.min(wide ? 120 : 84, height * 0.4);
  doc
    .font("bold")
    .fontSize(wide ? 30 : 19)
    .fillColor("#ffffff")
    .text("Не нашли нужное?", x + pad, y + pad, {
      width: width - pad * 2 - (wide ? qrSize + 20 : 0),
      lineGap: -2,
    });
  doc
    .font("bold")
    .fontSize(wide ? 14 : 10.5)
    .fillColor(T(doc).accent)
    .text(
      "Весь каталог ЛДСП, МДФ и фурнитуры — на сайте. Распил от 300 сом за лист, кромка и присадка в нашем цеху.",
      x + pad,
      doc.y + 8,
      {
        width: width - pad * 2 - (wide ? qrSize + 20 : 0),
        lineGap: 1,
      },
    );
  const qr = await QRCode.toBuffer(`${data.siteUrl}/catalog`, {
    margin: 1,
    width: 300,
    errorCorrectionLevel: "M",
    color: { dark: C.ink, light: "#ffffff" },
  });
  const qrX = x + width - pad - qrSize;
  const qrY = wide ? y + pad : y + height - pad - qrSize - 6;
  doc.rect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12).fill("#ffffff");
  doc.image(qr, qrX, qrY, { width: qrSize });
  if (wide && height > 260) {
    const services: [string, string][] = [
      ["Распил", "от 300 сом за лист"],
      ["Кромка", "ПВХ и ABS на станке"],
      ["Присадка", "отверстия под фурнитуру"],
    ];
    const tileGap = 12;
    const tileWidth = (width - pad * 2 - tileGap * 2) / 3;
    const tileHeight = 78;
    const tileY = y + height * 0.5 - tileHeight / 2 + 10;
    services.forEach(([title, text], i) => {
      const tx = x + pad + i * (tileWidth + tileGap);
      doc.rect(tx + 3, tileY + 4, tileWidth, tileHeight).fill(T(doc).bgDeep);
      doc.rect(tx, tileY, tileWidth, tileHeight).fill("#ffffff");
      doc.rect(tx, tileY, 5, tileHeight).fill(T(doc).accent);
      doc
        .font("bold")
        .fontSize(18)
        .fillColor(C.ink)
        .text(title, tx + 18, tileY + 16, { lineBreak: false });
      doc
        .font("regular")
        .fontSize(9.5)
        .fillColor(C.muted)
        .text(text, tx + 18, tileY + 44, {
          width: tileWidth - 26,
          lineBreak: false,
          ellipsis: true,
        });
    });
  }
  doc
    .font("bold")
    .fontSize(wide ? 22 : 14)
    .fillColor(T(doc).wedgeText)
    .text(data.contacts.phone, x + pad, y + height - pad - (wide ? 24 : 16), {
      lineBreak: false,
    });
  if (wide)
    doc
      .font("bold")
      .fontSize(11)
      .fillColor(T(doc).id === "new-year" ? T(doc).wedgeText : C.ink)
      .text(
        "Звоните или пишите в WhatsApp",
        x + width - pad - 260,
        y + height - pad - 16,
        { width: 260, align: "right", lineBreak: false },
      );
}

async function drawCover(
  doc: Doc,
  data: PromoMagazineData,
  photos: (Buffer | null)[],
) {
  const W = PAGE.width;
  const H = PAGE.height;
  doc.rect(0, 0, W, H).fill(T(doc).bg);
  // Лучи от центра заголовка — как на листовках гипермаркетов.
  doc.save();
  doc.opacity(0.08);
  const cx = W * 0.3;
  const cy = 250;
  for (let i = 0; i < 24; i += 2) {
    const a1 = (Math.PI * 2 * i) / 24;
    const a2 = (Math.PI * 2 * (i + 1)) / 24;
    doc
      .polygon(
        [cx, cy],
        [cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900],
        [cx + Math.cos(a2) * 900, cy + Math.sin(a2) * 900],
      )
      .fill("#ffffff");
  }
  doc.restore();
  if (T(doc).id === "new-year") {
    drawSnow(doc, 0, 0, W, 470, 90, 5);
    drawSnowflake(doc, W - 70, 330, 34, "#ffffff", 0.18);
    drawSnowflake(doc, 70, 420, 22, "#ffffff", 0.16);
  }
  // Косой клин снизу — на нём лежат товары.
  doc.polygon([0, 470], [W, 410], [W, H], [0, H]).fill(T(doc).wedge);
  doc.polygon([0, 470], [W, 410], [W, 422], [0, 482]).fill(T(doc).bgDeep);
  if (T(doc).id === "new-year") {
    doc.save();
    doc.polygon([0, 470], [W, 410], [W, H], [0, H]).clip();
    drawSnow(doc, 0, 410, W, H - 410, 40, 9);
    doc.restore();
    drawGarland(doc, -2, 12, W);
  }

  const left = PAGE.margin + 8;
  const right = W - PAGE.margin - 8;
  drawLogoMark(doc, left, 34, 38);
  doc
    .font("bold")
    .fontSize(19)
    .fillColor("#ffffff")
    .text("ARTISAN", left + 50, 37, { characterSpacing: 5, lineBreak: false });
  doc
    .font("regular")
    .fontSize(7.5)
    .fillColor(T(doc).soft)
    .text("МАТЕРИАЛЫ ДЛЯ МЕБЕЛИ · БИШКЕК", left + 51, 61, {
      characterSpacing: 1.4,
      lineBreak: false,
    });
  const { month, year } = bishkekParts(data.createdAt);
  const newYear = T(doc).id === "new-year";
  doc
    .font("bold")
    .fontSize(8)
    .fillColor(T(doc).soft)
    .text(newYear ? "НОВОГОДНИЙ ЖУРНАЛ" : "ЖУРНАЛ АКЦИЙ", right - 150, 39, {
      width: 150,
      align: "right",
      characterSpacing: 2,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(14)
    .fillColor(T(doc).accent)
    .text(`${MONTHS[month].toUpperCase()} ${year}`, right - 150, 52, {
      width: 150,
      align: "right",
      lineBreak: false,
    });

  doc
    .font("bold")
    .fontSize(118)
    .fillColor("#ffffff")
    .text("АКЦИИ", left - 4, 104, { lineBreak: false, characterSpacing: -3 });
  let titleTop = 262;
  if (data.maxPercent > 0) {
    doc.font("bold").fontSize(30);
    const lead = "СКИДКИ ДО";
    const leadWidth = doc.widthOfString(lead, { characterSpacing: 1 });
    doc
      .fillColor("#ffffff")
      .text(lead, left, 256, { lineBreak: false, characterSpacing: 1 });
    drawBurst(doc, left + leadWidth + 74, 274, 62, `−${data.maxPercent}%`, {
      fill: T(doc).accent,
      color: T(doc).sale,
      angle: -10,
    });
    titleTop = 312;
  }
  const titleWidth = right - left - 20;
  doc.font("bold").fontSize(24);
  doc.fillColor(T(doc).accent).text(data.title, left, titleTop, {
    width: titleWidth,
    height: 62,
    ellipsis: true,
    lineGap: -2,
  });
  const titleHeight = Math.min(
    62,
    doc.heightOfString(data.title, { width: titleWidth, lineGap: -2 }),
  );
  doc
    .font("bold")
    .fontSize(11)
    .fillColor("#ffffff")
    .text(
      `${magazineUntil(data.endsAt)} · ${data.products.length} ${plural(data.products.length, "товар", "товара", "товаров")} со скидкой`,
      left,
      titleTop + titleHeight + 6,
      { width: right - left, lineBreak: false, ellipsis: true },
    );

  // Три лучших предложения — карточками на жёлтом клине.
  const top = data.products.slice(0, 3);
  const gap = 12;
  const cardWidth = (right - left - gap * 2) / 3;
  const cardHeight = 290;
  for (const [i, product] of top.entries()) {
    const x = left + i * (cardWidth + gap);
    const y = 462 - i * 16;
    doc.save();
    doc
      .roundedRect(x + 3, y + 4, cardWidth, cardHeight, 8)
      .fill(T(doc).saleDeep);
    doc.restore();
    await drawCard(doc, product, photos[i], x, y, cardWidth, cardHeight);
  }

  // Низ обложки: контакты на тёмно-красной полосе.
  doc.rect(0, H - 54, W, 54).fill(T(doc).bgDark);
  doc
    .font("bold")
    .fontSize(15)
    .fillColor("#ffffff")
    .text(data.contacts.phone, left, H - 40, { lineBreak: false });
  doc
    .font("regular")
    .fontSize(8.5)
    .fillColor(T(doc).soft)
    .text(`${data.contacts.address} · ${data.contacts.hours}`, left, H - 21, {
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(11)
    .fillColor(T(doc).accent)
    .text(data.siteUrl.replace(/^https?:\/\//, ""), right - 220, H - 36, {
      width: 220,
      align: "right",
      lineBreak: false,
    });
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

async function drawBackCover(doc: Doc, data: PromoMagazineData) {
  const W = PAGE.width;
  const H = PAGE.height;
  doc.rect(0, 0, W, H).fill(C.ink);
  doc.polygon([0, 0], [W, 0], [W, 300], [0, 360]).fill(T(doc).bg);
  doc.polygon([0, 360], [W, 300], [W, 312], [0, 372]).fill(T(doc).accent);
  const left = PAGE.margin + 18;
  const right = W - PAGE.margin - 18;
  const newYear = T(doc).id === "new-year";
  if (newYear) {
    doc.save();
    doc.polygon([0, 0], [W, 0], [W, 300], [0, 360]).clip();
    drawSnow(doc, 0, 0, W, 360, 70, 3);
    drawSnowflake(doc, W - 110, 170, 60, "#ffffff", 0.16);
    doc.restore();
    drawGarland(doc, -2, 12, W);
  }
  drawLogoMark(doc, left, 60, 52);
  doc
    .font("bold")
    .fontSize(newYear ? 42 : 46)
    .fillColor("#ffffff")
    .text(newYear ? "С Новым годом!" : "Ждём вас", left, 140, {
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(newYear ? 34 : 46)
    .fillColor(T(doc).accent)
    .text(
      newYear ? "Ждём вас в Artisan" : "в Artisan!",
      left,
      newYear ? 194 : 192,
      {
        lineBreak: false,
      },
    );

  const rows: [string, string][] = [
    ["Телефон и WhatsApp", data.contacts.phone],
    ["Адрес", data.contacts.address],
    ["Режим работы", data.contacts.hours],
    ["Сайт", data.siteUrl.replace(/^https?:\/\//, "")],
  ];
  let y = 420;
  for (const [label, value] of rows) {
    doc
      .font("regular")
      .fontSize(9)
      .fillColor("#a9a29a")
      .text(label.toUpperCase(), left, y, {
        characterSpacing: 1.5,
        lineBreak: false,
      });
    doc
      .font("bold")
      .fontSize(18)
      .fillColor("#ffffff")
      .text(value, left, y + 14, {
        width: 300,
        lineBreak: false,
        ellipsis: true,
      });
    y += 58;
  }
  const qrSize = 130;
  const qr = await QRCode.toBuffer(`${data.siteUrl}/catalog`, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
    color: { dark: C.ink, light: "#ffffff" },
  });
  doc.rect(right - qrSize - 10, 420, qrSize + 20, qrSize + 44).fill("#ffffff");
  doc.image(qr, right - qrSize, 430, { width: qrSize });
  doc
    .font("bold")
    .fontSize(9)
    .fillColor(C.ink)
    .text("Весь каталог на сайте", right - qrSize - 10, 430 + qrSize + 10, {
      width: qrSize + 20,
      align: "center",
      lineBreak: false,
    });

  const services: [string, string][] = [
    ["Распил", "по вашим размерам"],
    ["Кромка", "ПВХ и ABS"],
    ["Присадка", "под фурнитуру"],
  ];
  const tileGap = 10;
  const tileWidth = (right - left - tileGap * 2) / 3;
  services.forEach(([title, text], i) => {
    const tx = left + i * (tileWidth + tileGap);
    doc.rect(tx, 650, tileWidth, 74).fill("#24201b");
    doc.rect(tx, 650, 4, 74).fill(T(doc).accent);
    doc
      .font("bold")
      .fontSize(17)
      .fillColor("#ffffff")
      .text(title, tx + 16, 664, { lineBreak: false });
    doc
      .font("regular")
      .fontSize(9)
      .fillColor("#a9a29a")
      .text(text, tx + 16, 690, { width: tileWidth - 24, lineBreak: false });
  });

  const date = data.createdAt.toLocaleDateString("ru-RU", {
    timeZone: "Asia/Bishkek",
  });
  doc
    .font("regular")
    .fontSize(8)
    .fillColor("#8d867e")
    .text(
      `Цены указаны в сомах на ${date}. Количество акционного товара ограничено. Скидки по разным акциям не суммируются. Распил, кромка и присадка в цеху Artisan.`,
      left,
      H - 70,
      { width: right - left, lineGap: 2 },
    );
}

export async function renderPromoMagazine(
  data: PromoMagazineData,
  photos: (Buffer | null)[],
  themeId: MagazineThemeId = defaultMagazineTheme(data.createdAt),
) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    info: { Title: `Artisan — ${data.title}`, Author: "Artisan" },
  });
  const fonts = path.join(process.cwd(), "public/fonts");
  doc.registerFont("regular", path.join(fonts, "NotoSans-Regular.ttf"));
  doc.registerFont("bold", path.join(fonts, "NotoSans-Bold.ttf"));
  doc.font("regular");
  docThemes.set(doc, THEMES[themeId]);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Общий журнал в новогодней теме называется «Новогодние акции».
  if (themeId === "new-year" && data.title === "Акции месяца")
    data = { ...data, title: "Новогодние акции" };
  await drawCover(doc, data, photos);

  const products = data.products;
  const pages = magazinePages(products.length);
  const top = 62;
  const bottom = PAGE.height - 40;
  const gap = 12;
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const heroHeight = 236;
  const cardWidth = (contentWidth - gap) / 2;
  const cardHeight = (bottom - top - heroHeight - gap * 2) / 2;
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    doc.rect(0, 0, PAGE.width, PAGE.height).fill(C.warm);
    drawPageHeader(doc, data);
    const start = page * PER_PAGE;
    const slice = products.slice(start, start + PER_PAGE);
    if (slice[0])
      await drawHero(
        doc,
        slice[0],
        photos[start],
        PAGE.margin,
        top,
        contentWidth,
        heroHeight,
        page % 2 === 1,
      );
    for (let i = 1; i < slice.length; i++) {
      const col = (i - 1) % 2;
      const row = Math.floor((i - 1) / 2);
      await drawCard(
        doc,
        slice[i],
        photos[start + i],
        PAGE.margin + col * (cardWidth + gap),
        top + heroHeight + gap + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
      );
    }
    // Последняя страница не остаётся полупустой: остаток — баннер «весь
    // каталог на сайте» с QR.
    const usedRows = slice.length > 1 ? Math.ceil((slice.length - 1) / 2) : 0;
    const usedBottom =
      top +
      heroHeight +
      (usedRows ? gap + usedRows * (cardHeight + gap) - gap : 0);
    const oddCard = slice.length > 1 && (slice.length - 1) % 2 === 1;
    if (oddCard) {
      await drawBanner(
        doc,
        data,
        PAGE.margin + cardWidth + gap,
        usedBottom - cardHeight,
        cardWidth,
        cardHeight,
      );
    } else if (bottom - usedBottom > 120) {
      await drawBanner(
        doc,
        data,
        PAGE.margin,
        usedBottom + gap,
        contentWidth,
        bottom - usedBottom - gap,
      );
    }
    drawPageFooter(doc, data, page + 2);
  }

  doc.addPage();
  await drawBackCover(doc, data);
  doc.end();
  return result;
}
