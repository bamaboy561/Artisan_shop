import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import type { PromoMagazineData } from "@/lib/server/promo-magazine-data";
import { catalogThumbnail } from "@/lib/server/catalog-thumbnail";

// Журнал акций «Галерея декоров»: светлая бумага, крупные образцы декоров,
// заголовки антиквой (Playfair Display), цены гротеском (Manrope).

type Doc = InstanceType<typeof PDFDocument>;
type MagazineProduct = PromoMagazineData["products"][number];

const PAGE = { width: 595.28, height: 841.89, margin: 36 };

// Темы журнала: обычная и новогодняя. Тема хранится на документе, чтобы
// параллельные выгрузки с разными темами не мешали друг другу.
export type MagazineThemeId = "classic" | "new-year";
type MagazineTheme = {
  id: MagazineThemeId;
  paper: string; // фон страниц
  ink: string; // основной текст
  muted: string; // подписи
  faint: string; // мелкие подписи, зачёркнутая цена
  line: string; // тонкие линии
  photo: string; // подложка фото
  accent: string; // цены, акцентные слова, скидка
  stamp: string; // круглая печать скидки на обложке
  stampText: string;
  panel: string; // плашка «Не нашли нужное?»
  panelText: string;
  panelSoft: string;
};
const THEMES: Record<MagazineThemeId, MagazineTheme> = {
  classic: {
    id: "classic",
    paper: "#f3efe7",
    ink: "#1d1b18",
    muted: "#5d574e",
    faint: "#857d70",
    line: "#d8d0c2",
    photo: "#e8e1d4",
    accent: "#9a3b24",
    stamp: "#9a3b24",
    stampText: "#f3efe7",
    panel: "#1d1b18",
    panelText: "#f3efe7",
    panelSoft: "#b9b1a4",
  },
  "new-year": {
    id: "new-year",
    paper: "#f4f0e8",
    ink: "#1a1f1b",
    muted: "#55594f",
    faint: "#80857a",
    line: "#d6d3c6",
    photo: "#e6e2d6",
    accent: "#a3122a",
    stamp: "#1f5c45",
    stampText: "#f4f0e8",
    panel: "#1f5c45",
    panelText: "#f4f0e8",
    panelSoft: "#bcd5c8",
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

// Шрифты: serif — заголовки, sans — текст, bold — цены и названия.
const F = { serif: "serif", sans: "sans", bold: "bold" } as const;

function drawSnowflake(
  doc: Doc,
  cx: number,
  cy: number,
  r: number,
  color: string,
  opacity = 1,
) {
  doc.save();
  doc
    .opacity(opacity)
    .strokeColor(color)
    .lineWidth(Math.max(0.5, r / 10))
    .lineCap("round");
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    doc
      .moveTo(cx, cy)
      .lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      .stroke();
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

// Несколько снежинок в заданной области: детерминированно, чтобы журнал
// выглядел одинаково при каждой выгрузке.
function drawSnowAccent(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  color: string,
  seed = 7,
) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++)
    drawSnowflake(
      doc,
      x + rand() * width,
      y + rand() * height,
      4 + rand() * 9,
      color,
      0.35 + rand() * 0.4,
    );
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

// Срок акции для обложки. У акции, которая начнётся позже, сначала дата
// начала: журнал печатают заранее, и клиент должен видеть, с какого дня цена.
export function magazineUntil(date: Date | null, startsAt: Date | null = null) {
  if (startsAt) {
    const start = bishkekParts(startsAt);
    const from = `с ${start.day} ${MONTHS_GENITIVE[start.month]}`;
    if (!date) return `Акция ${from} ${start.year}`;
    const { day, month, year } = bishkekParts(date);
    return `Акция ${from}${start.year === year ? "" : ` ${start.year}`} до ${day} ${MONTHS_GENITIVE[month]} ${year}`;
  }
  if (!date) return "Пока товар есть в наличии";
  const { day, month, year } = bishkekParts(date);
  return `Акция до ${day} ${MONTHS_GENITIVE[month]} ${year}`;
}

// Коротко для печати на обложке: «до 31 декабря».
function untilShort(date: Date | null, startsAt: Date | null) {
  if (startsAt) {
    const { day, month } = bishkekParts(startsAt);
    return `с ${day} ${MONTHS_GENITIVE[month]}`;
  }
  if (!date) return "пока есть товар";
  const { day, month } = bishkekParts(date);
  return `до ${day} ${MONTHS_GENITIVE[month]}`;
}

function shortDate(date: Date | null) {
  if (!date) return "";
  const { day, month } = bishkekParts(date);
  return `до ${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}`;
}

const money = (value: number) => value.toLocaleString("ru-RU");

// Раскладка страницы: крупный товар во всю ширину и сетка 3×2 под ним.
export const PER_PAGE = 7;
export function magazinePages(count: number) {
  return Math.max(1, Math.ceil(count / PER_PAGE));
}
const LAYOUT = {
  top: 84,
  bottom: PAGE.height - 44,
  heroHeight: 214,
  gap: 22,
  colGap: 16,
};

export async function loadMagazinePhotos(data: PromoMagazineData) {
  const photos: (Buffer | null)[] = new Array(data.products.length).fill(null);
  const deadline = Date.now() + 90_000;
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < data.products.length) {
        const current = index++;
        if (Date.now() > deadline) return;
        // Крупно: обложка (первые товары) и первый товар каждой страницы.
        const large = current < 8 || current % PER_PAGE === 0;
        const product = data.products[current];
        const photo = await catalogThumbnail(
          product.imageUrl,
          large ? [900, 760] : [520, 440],
        );
        // Убираем белые поля, которые миниатюра добавляет при вписывании:
        // декор заполняет всё окно, а фурнитура не теряется в пустоте.
        photos[current] = photo
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

// Логотип Artisan из public/brand (SVG → PNG через sharp). Если файлов нет,
// пишем название текстом, чтобы журнал собирался в любом случае.
type BrandLogos = { horizontal: Buffer | null; mark: Buffer | null };
let brandLogos: Promise<BrandLogos> | null = null;
async function svgToPng(file: string, height: number) {
  try {
    return await sharp(path.join(process.cwd(), "public/brand", file), {
      density: 300,
    })
      .resize({ height })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
export function loadBrandLogos() {
  brandLogos ??= Promise.all([
    svgToPng("artisan-logo-horizontal.svg", 240),
    svgToPng("artisan-mark.svg", 200),
  ]).then(([horizontal, mark]) => ({ horizontal, mark }));
  return brandLogos;
}
const docLogos = new WeakMap<Doc, BrandLogos>();
const HORIZONTAL_RATIO = 1358 / 258;

function drawLogo(doc: Doc, x: number, y: number, height: number) {
  const logo = docLogos.get(doc)?.horizontal;
  if (logo) {
    doc.image(logo, x, y, { height, width: height * HORIZONTAL_RATIO });
    return;
  }
  doc
    .font(F.serif)
    .fontSize(height * 0.8)
    .fillColor(T(doc).ink)
    .text("ARTISAN", x, y, { lineBreak: false, characterSpacing: 2 });
}

// Подбираем кегль, чтобы текст влез в ширину и число строк.
function fitSize(
  doc: Doc,
  text: string,
  font: string,
  max: number,
  min: number,
  width: number,
  lines: number,
  lineGap = 0,
) {
  for (let size = max; size > min; size -= 1) {
    doc.font(font).fontSize(size);
    const words = text.split(/\s+/);
    if (words.some((word) => doc.widthOfString(word) > width)) continue;
    const height = doc.heightOfString(text, { width, lineGap });
    if (height <= lines * (doc.currentLineHeight() + lineGap) + 1) return size;
  }
  return min;
}

function strike(doc: Doc, text: string, x: number, y: number, size: number) {
  const t = T(doc);
  doc.font(F.sans).fontSize(size).fillColor(t.faint);
  doc.text(text, x, y, { lineBreak: false });
  const w = doc.widthOfString(text);
  doc
    .moveTo(x, y + size * 0.62)
    .lineTo(x + w, y + size * 0.62)
    .lineWidth(Math.max(0.5, size / 14))
    .strokeColor(t.faint)
    .stroke();
}

// Цена: новая крупно акцентным цветом, рядом «сом» и зачёркнутая старая.
function drawPrice(
  doc: Doc,
  product: MagazineProduct,
  x: number,
  baseline: number,
  size: number,
) {
  const t = T(doc);
  const price = money(product.price);
  doc.font(F.bold).fontSize(size).fillColor(t.accent);
  doc.text(price, x, baseline - size * 0.8, {
    lineBreak: false,
    characterSpacing: -0.3,
  });
  let cx =
    x + doc.widthOfString(price, { characterSpacing: -0.3 }) + size * 0.14;
  const small = Math.max(7, size * 0.36);
  doc
    .font(F.bold)
    .fontSize(small)
    .fillColor(t.accent)
    .text("сом", cx, baseline - small * 0.82, { lineBreak: false });
  cx += doc.widthOfString("сом") + small * 0.9;
  if (product.oldPrice)
    strike(doc, money(product.oldPrice), cx, baseline - small * 0.82, small);
}

function drawChip(doc: Doc, text: string, x: number, y: number, size: number) {
  const t = T(doc);
  doc.font(F.bold).fontSize(size);
  const w = doc.widthOfString(text) + size * 1.1;
  doc.rect(x, y, w, size * 1.75).fill(t.paper);
  doc
    .fillColor(t.accent)
    .text(text, x + size * 0.55, y + size * 0.42, { lineBreak: false });
}

function drawPhoto(
  doc: Doc,
  photo: Buffer | null,
  fill: boolean,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.save();
  doc.rect(x, y, width, height).fill(T(doc).photo);
  doc.rect(x, y, width, height).clip();
  if (photo) {
    // Декор плиты — на всё окно, товар (фурнитура, интерьер) — целиком.
    if (fill)
      doc.image(photo, x, y, {
        cover: [width, height],
        align: "center",
        valign: "center",
      });
    else {
      doc.rect(x, y, width, height).fill("#ffffff");
      doc.image(photo, x + 10, y + 10, {
        fit: [width - 20, height - 20],
        align: "center",
        valign: "center",
      });
    }
  } else {
    const mark = docLogos.get(doc)?.mark;
    if (mark)
      doc.image(mark, x + width / 2 - 14, y + height / 2 - 14, { height: 28 });
  }
  doc.restore();
}

async function qrImage(url: string, dark: string, light: string) {
  return QRCode.toBuffer(url, {
    margin: 0,
    width: 160,
    errorCorrectionLevel: "L",
    color: { dark, light },
  });
}

// «2800 × 2070 мм, 16 мм · до 15.12 · под заказ»: свой срок показываем,
// только если он отличается от срока всего журнала.
function detailLine(product: MagazineProduct, until: Date | null) {
  const end =
    product.endsAt && (!until || product.endsAt.getTime() !== until.getTime())
      ? shortDate(product.endsAt)
      : "";
  return [product.format, end, product.inStock ? "" : "под заказ"]
    .filter(Boolean)
    .join(" · ");
}

const brandLine = (product: MagazineProduct) =>
  [product.brand, product.category].filter(Boolean).join(" · ");

async function drawCard(
  doc: Doc,
  data: PromoMagazineData,
  product: MagazineProduct,
  photo: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const t = T(doc);
  const photoHeight = height - 76;
  drawPhoto(doc, photo, product.isSheet, x, y, width, photoHeight);
  if (product.percent > 0)
    drawChip(doc, `−${product.percent}%`, x + 7, y + 7, 8.5);

  let ty = y + photoHeight + 8;
  doc
    .font(F.sans)
    .fontSize(6.8)
    .fillColor(t.faint)
    .text(brandLine(product), x, ty, {
      width,
      lineBreak: false,
      ellipsis: true,
    });
  ty += 10;
  doc.font(F.bold).fontSize(9.2).fillColor(t.ink);
  const nameHeight = Math.min(
    23,
    doc.heightOfString(product.name, { width, lineGap: -0.5 }),
  );
  doc.text(product.name, x, ty, {
    width,
    height: 23,
    ellipsis: true,
    lineGap: -0.5,
  });
  ty += nameHeight + 2;
  doc
    .font(F.sans)
    .fontSize(7)
    .fillColor(t.faint)
    .text(detailLine(product, data.endsAt), x, ty, {
      width,
      lineBreak: false,
      ellipsis: true,
    });

  const qrSize = 26;
  doc.image(
    await qrImage(product.url, t.ink, t.paper),
    x + width - qrSize,
    y + height - qrSize,
    { width: qrSize },
  );
  drawPrice(doc, product, x, y + height - 2, product.price >= 100000 ? 14 : 17);
}

async function drawHero(
  doc: Doc,
  data: PromoMagazineData,
  product: MagazineProduct,
  photo: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const t = T(doc);
  const photoWidth = Math.round(width * 0.58);
  drawPhoto(doc, photo, product.isSheet, x, y, photoWidth, height);
  if (product.percent > 0)
    drawChip(doc, `−${product.percent}%`, x + 10, y + 10, 12);

  const tx = x + photoWidth + 24;
  const tw = width - photoWidth - 24;
  const nameSize = fitSize(doc, product.name, F.serif, 27, 15, tw, 3, -2);
  doc.font(F.serif).fontSize(nameSize);
  const nameHeight = doc.heightOfString(product.name, {
    width: tw,
    lineGap: -2,
  });
  const priceSize = product.price >= 100000 ? 28 : 34;
  const block = 13 + nameHeight + 8 + 14 + priceSize + 4;
  let ty = Math.max(y, y + height - 44 - block);
  doc
    .font(F.sans)
    .fontSize(7.5)
    .fillColor(t.faint)
    .text(brandLine(product), tx, ty, {
      width: tw,
      lineBreak: false,
      ellipsis: true,
    });
  ty += 13;
  doc
    .font(F.serif)
    .fontSize(nameSize)
    .fillColor(t.ink)
    .text(product.name, tx, ty, { width: tw, lineGap: -2 });
  ty += nameHeight + 8;
  doc
    .font(F.sans)
    .fontSize(9)
    .fillColor(t.muted)
    .text(detailLine(product, data.endsAt), tx, ty, {
      width: tw,
      lineBreak: false,
      ellipsis: true,
    });
  ty += 14 + priceSize;
  drawPrice(doc, product, tx, ty, priceSize);

  const qrSize = 30;
  doc.image(
    await qrImage(product.url, t.ink, t.paper),
    tx,
    y + height - qrSize,
    {
      width: qrSize,
    },
  );
  doc
    .font(F.sans)
    .fontSize(7)
    .fillColor(t.faint)
    .text(
      "Наведите камеру,\nчтобы открыть товар",
      tx + qrSize + 8,
      y + height - qrSize + 6,
      { width: tw - qrSize - 8, lineGap: 1 },
    );
}

function drawPageHeader(doc: Doc, data: PromoMagazineData, page: number) {
  const t = T(doc);
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const titleSize = fitSize(doc, data.title, F.serif, 25, 14, 330, 1);
  doc
    .font(F.serif)
    .fontSize(titleSize)
    .fillColor(t.ink)
    .text(data.title, left, 54 - titleSize * 1.1, {
      width: 330,
      lineBreak: false,
      ellipsis: true,
    });
  doc
    .font(F.sans)
    .fontSize(8)
    .fillColor(t.faint)
    .text(
      `${magazineUntil(data.endsAt, data.startsAt)} · стр. ${page}`,
      left + 300,
      42,
      { width: right - left - 300, align: "right", lineBreak: false },
    );
  doc
    .moveTo(left, 62)
    .lineTo(right, 62)
    .lineWidth(0.6)
    .strokeColor(t.line)
    .stroke();
  if (t.id === "new-year") drawSnowflake(doc, right - 4, 24, 6, t.accent, 0.5);
}

function drawPageFooter(doc: Doc, data: PromoMagazineData) {
  const t = T(doc);
  const y = PAGE.height - 28;
  doc.font(F.sans).fontSize(7.5).fillColor(t.faint);
  doc.text(data.siteUrl.replace(/^https?:\/\//, ""), PAGE.margin, y, {
    lineBreak: false,
  });
  doc.text(data.contacts.phone, PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
    align: "right",
    lineBreak: false,
  });
}

// Пустое место на последней странице: «Не нашли нужное?» с QR на каталог.
async function drawBanner(
  doc: Doc,
  data: PromoMagazineData,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const t = T(doc);
  const wide = width > 300;
  doc.rect(x, y, width, height).fill(t.panel);
  const pad = wide ? 26 : 16;
  const qrSize = Math.min(wide ? 84 : 60, height - pad * 2);
  // Снежинки только под QR, чтобы не заходить на текст.
  if (t.id === "new-year" && height - pad * 2 - qrSize > 24)
    drawSnowAccent(
      doc,
      x + width - pad - qrSize,
      y + pad + qrSize + 18,
      qrSize,
      height - pad * 2 - qrSize - 18,
      wide ? 4 : 2,
      t.panelText,
      11,
    );
  const textWidth = width - pad * 3 - qrSize;
  doc.font(F.serif).fontSize(wide ? 28 : 18);
  const title = "Не нашли нужное?";
  const titleHeight = doc.heightOfString(title, { width: textWidth });
  doc
    .fillColor(t.panelText)
    .text(title, x + pad, y + pad, { width: textWidth });
  const phoneSize = wide ? 16 : 11;
  doc
    .font(F.sans)
    .fontSize(wide ? 10 : 7.8)
    .fillColor(t.panelSoft)
    .text(
      "Весь каталог ЛДСП, МДФ и фурнитуры на сайте. Распил от 300 сом за лист, кромка и присадка в нашем цеху.",
      x + pad,
      y + pad + titleHeight + 8,
      {
        width: textWidth,
        lineGap: 2,
        height: Math.max(10, height - pad * 2 - titleHeight - phoneSize - 16),
        ellipsis: true,
      },
    );
  doc
    .font(F.bold)
    .fontSize(phoneSize)
    .fillColor(t.panelText)
    .text(data.contacts.phone, x + pad, y + height - pad - phoneSize, {
      lineBreak: false,
    });
  const qx = x + width - pad - qrSize;
  doc.rect(qx - 6, y + pad - 6, qrSize + 12, qrSize + 12).fill(t.panelText);
  doc.image(
    await qrImage(`${data.siteUrl}/catalog`, t.panel, t.panelText),
    qx,
    y + pad,
    {
      width: qrSize,
    },
  );
}

// Услуги цеха: на задней обложке и в пустом ряду последней страницы.
function drawServices(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const t = T(doc);
  const items = [
    ["Распил", "Режем листы по вашим размерам на станках HOMAG и Altendorf."],
    ["Кромка", "Кромим ПВХ и ABS в нашем цеху."],
    ["Присадка", "Сверлим отверстия под петли, конфирматы и полкодержатели."],
  ];
  const colWidth = (width - LAYOUT.colGap * 2) / 3;
  doc
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineWidth(0.6)
    .strokeColor(t.line)
    .stroke();
  items.forEach(([title, text], i) => {
    const cx = x + i * (colWidth + LAYOUT.colGap);
    doc
      .font(F.serif)
      .fontSize(24)
      .fillColor(t.accent)
      .text(title, cx, y + 22, { width: colWidth, lineBreak: false });
    doc
      .font(F.sans)
      .fontSize(9.5)
      .fillColor(t.muted)
      .text(text, cx, y + 60, {
        width: colWidth - 6,
        lineGap: 2.5,
        height: Math.max(12, height - 70),
        ellipsis: true,
      });
  });
}

function pickCoverPhotos(data: PromoMagazineData, photos: (Buffer | null)[]) {
  const withPhoto = data.products
    .map((product, index) => ({ product, photo: photos[index] }))
    .filter(
      (item): item is { product: MagazineProduct; photo: Buffer } =>
        item.photo !== null,
    );
  // Сначала декоры: на обложке они смотрятся как образцы.
  const sheets = withPhoto.filter((item) => item.product.isSheet);
  const others = withPhoto.filter((item) => !item.product.isSheet);
  return [...sheets, ...others].slice(0, 5);
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

async function drawCover(
  doc: Doc,
  data: PromoMagazineData,
  photos: (Buffer | null)[],
) {
  const t = T(doc);
  const W = PAGE.width;
  const H = PAGE.height;
  const left = PAGE.margin;
  const right = W - PAGE.margin;
  const newYear = t.id === "new-year";
  doc.rect(0, 0, W, H).fill(t.paper);

  drawLogo(doc, left, 28, 26);
  const { month, year } = bishkekParts(data.startsAt ?? data.createdAt);
  doc
    .font(F.sans)
    .fontSize(8.5)
    .fillColor(t.muted)
    .text(
      `${newYear ? "Новогодний журнал акций" : "Журнал акций"} · ${MONTHS[month]} ${year}`,
      left + 200,
      38,
      { width: right - left - 200, align: "right", lineBreak: false },
    );

  // Мозаика образцов: большой слева, четыре справа.
  const cover = pickCoverPhotos(data, photos);
  const my = 72;
  const mw = right - left;
  const mh = 400;
  const gap = 5;
  const bigW = Math.round(mw * 0.385);
  const smallW = (mw - bigW - gap * 2) / 2;
  const smallH = (mh - gap) / 2;
  const cells: [number, number, number, number][] = [
    [left, my, bigW, mh],
    [left + bigW + gap, my, smallW, smallH],
    [left + bigW + gap * 2 + smallW, my, smallW, smallH],
    [left + bigW + gap, my + smallH + gap, smallW, smallH],
    [left + bigW + gap * 2 + smallW, my + smallH + gap, smallW, smallH],
  ];
  cells.forEach(([cx, cy, cw, ch], i) => {
    const item = cover.length ? cover[i % cover.length] : null;
    drawPhoto(
      doc,
      item?.photo ?? null,
      item?.product.isSheet ?? true,
      cx,
      cy,
      cw,
      ch,
    );
  });

  // Заголовок антиквой, последнее слово — акцентным цветом.
  const kicker = newYear
    ? "С Новым годом"
    : `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;
  doc
    .font(F.serif)
    .fontSize(19)
    .fillColor(t.accent)
    .text(kicker, left, 498, { lineBreak: false });
  // Две строки: начало названия чернилами, последнее слово акцентом.
  const words = data.title.trim().split(/\s+/);
  const titleWidth = right - left - 130;
  const head = words.length > 1 ? words.slice(0, -1).join(" ") : words[0];
  const tail = words.length > 1 ? words[words.length - 1] : "";
  const titleSize = Math.min(
    fitSize(doc, head, F.serif, 78, 30, titleWidth, 1),
    tail ? fitSize(doc, tail, F.serif, 78, 30, titleWidth, 1) : 78,
  );
  const titleGap = -titleSize * 0.22;
  doc.font(F.serif).fontSize(titleSize);
  let titleY = 524;
  const headHeight = Math.min(
    doc.heightOfString(head, { width: titleWidth, lineGap: titleGap }),
    titleSize * 2.3,
  );
  doc.fillColor(t.ink).text(head, left, titleY, {
    width: titleWidth,
    lineGap: titleGap,
    height: headHeight,
    ellipsis: true,
  });
  titleY += headHeight;
  if (tail) {
    doc.fillColor(t.accent).text(tail, left, titleY, {
      width: titleWidth,
      lineBreak: false,
      ellipsis: true,
    });
    titleY += doc.heightOfString(tail, {
      width: titleWidth,
      lineGap: titleGap,
    });
  }
  const afterTitle = titleY + 16;

  const subtitle =
    data.subtitle?.trim() ||
    "ЛДСП, МДФ, столешницы и фурнитура по ценам акции. Распил, кромка и присадка в нашем цеху.";
  doc
    .font(F.sans)
    .fontSize(10.5)
    .fillColor(t.muted)
    .text(subtitle, left, Math.min(afterTitle, 700), {
      width: 340,
      lineGap: 3,
      height: 44,
      ellipsis: true,
    });

  // Печать со скидкой.
  const r = 56;
  const cx = right - r;
  const cy = 552;
  doc.circle(cx, cy, r).fill(t.stamp);
  const pct = `−${data.maxPercent}%`;
  const pctSize = fitSize(doc, pct, F.serif, 40, 22, r * 1.7, 1);
  doc
    .font(F.serif)
    .fontSize(pctSize)
    .fillColor(t.stampText)
    .text(pct, cx - r, cy - pctSize * 0.78, {
      width: r * 2,
      align: "center",
      lineBreak: false,
    });
  doc
    .font(F.sans)
    .fontSize(8)
    .fillColor(t.stampText)
    .text(untilShort(data.endsAt, data.startsAt), cx - r, cy + pctSize * 0.4, {
      width: r * 2,
      align: "center",
      lineBreak: false,
    });
  if (newYear) {
    drawSnowflake(doc, cx - r - 14, cy - r + 4, 9, t.accent, 0.8);
    drawSnowflake(doc, cx + r - 4, cy + r + 8, 6, t.stamp, 0.7);
  }

  // Низ обложки: телефон, адрес, QR на каталог.
  const footY = H - 92;
  doc
    .moveTo(left, footY)
    .lineTo(right, footY)
    .lineWidth(0.6)
    .strokeColor(t.line)
    .stroke();
  doc
    .font(F.bold)
    .fontSize(16)
    .fillColor(t.ink)
    .text(data.contacts.phone, left, footY + 22, { lineBreak: false });
  doc
    .font(F.sans)
    .fontSize(9)
    .fillColor(t.muted)
    .text(
      `${data.contacts.address} · ${data.contacts.hours} · ${data.products.length} ${plural(data.products.length, "товар", "товара", "товаров")} со скидкой`,
      left,
      footY + 46,
      { width: right - left - 80, lineBreak: false, ellipsis: true },
    );
  const qrSize = 52;
  doc.image(
    await qrImage(`${data.siteUrl}/catalog`, t.ink, t.paper),
    right - qrSize,
    footY + 16,
    { width: qrSize },
  );
}

async function drawBackCover(doc: Doc, data: PromoMagazineData) {
  const t = T(doc);
  const W = PAGE.width;
  const H = PAGE.height;
  const left = PAGE.margin;
  const right = W - PAGE.margin;
  const newYear = t.id === "new-year";
  doc.rect(0, 0, W, H).fill(t.paper);
  drawLogo(doc, left, 28, 26);
  if (newYear) drawSnowAccent(doc, right - 170, 96, 170, 150, 7, t.accent, 5);

  doc
    .font(F.serif)
    .fontSize(19)
    .fillColor(t.accent)
    .text(
      newYear ? "С Новым годом!" : "Спасибо, что выбираете нас",
      left,
      110,
      {
        lineBreak: false,
      },
    );
  doc
    .font(F.serif)
    .fontSize(64)
    .fillColor(t.ink)
    .text("Ждём вас", left, 136, { lineBreak: false });
  doc.fillColor(t.accent).text("в Artisan", left, 204, { lineBreak: false });

  const rows: [string, string][] = [
    ["Телефон и WhatsApp", data.contacts.phone],
    ["Адрес", data.contacts.address],
    ["Режим работы", data.contacts.hours],
    ["Сайт", data.siteUrl.replace(/^https?:\/\//, "")],
  ];
  let y = 320;
  const listWidth = 330;
  for (const [label, value] of rows) {
    doc
      .moveTo(left, y)
      .lineTo(left + listWidth, y)
      .lineWidth(0.6)
      .strokeColor(t.line)
      .stroke();
    doc
      .font(F.sans)
      .fontSize(8)
      .fillColor(t.faint)
      .text(label, left, y + 12, { lineBreak: false });
    doc
      .font(F.bold)
      .fontSize(15)
      .fillColor(t.ink)
      .text(value, left, y + 26, {
        width: listWidth,
        lineBreak: false,
        ellipsis: true,
      });
    y += 58;
  }
  doc
    .moveTo(left, y)
    .lineTo(left + listWidth, y)
    .lineWidth(0.6)
    .strokeColor(t.line)
    .stroke();

  const qrSize = 116;
  const qx = right - qrSize;
  doc.image(await qrImage(`${data.siteUrl}/catalog`, t.ink, t.paper), qx, 332, {
    width: qrSize,
  });
  doc
    .font(F.serif)
    .fontSize(15)
    .fillColor(t.ink)
    .text("Весь каталог\nна сайте", qx, 332 + qrSize + 12, {
      width: qrSize,
      lineGap: -1,
    });

  drawServices(doc, left, 600, right - left, 120);

  const date = (data.startsAt ?? data.createdAt).toLocaleDateString("ru-RU", {
    timeZone: "Asia/Bishkek",
  });
  const pricesNote = data.startsAt
    ? `Цены по акции действуют с ${date}, до этого дня товар продаётся по обычной цене.`
    : `Цены указаны в сомах на ${date}.`;
  doc
    .font(F.sans)
    .fontSize(7.5)
    .fillColor(t.faint)
    .text(
      `${pricesNote} Количество акционного товара ограничено. Скидки по разным акциям не суммируются. Распил, кромка и присадка в цеху Artisan.`,
      left,
      H - 62,
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
  doc.registerFont(F.serif, path.join(fonts, "PlayfairDisplay-Regular.ttf"));
  doc.registerFont(F.sans, path.join(fonts, "Manrope-Medium.ttf"));
  doc.registerFont(F.bold, path.join(fonts, "Manrope-ExtraBold.ttf"));
  doc.font(F.sans);
  docThemes.set(doc, THEMES[themeId]);
  docLogos.set(doc, await loadBrandLogos());
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

  const t = T(doc);
  const products = data.products;
  const pages = magazinePages(products.length);
  const left = PAGE.margin;
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const { top, bottom, heroHeight, gap, colGap } = LAYOUT;
  const colWidth = (contentWidth - colGap * 2) / 3;
  const rowTop = top + heroHeight + gap;
  const rowHeight = (bottom - rowTop - gap) / 2;
  for (let page = 0; page < pages; page++) {
    doc.addPage();
    doc.rect(0, 0, PAGE.width, PAGE.height).fill(t.paper);
    drawPageHeader(doc, data, page + 2);
    const start = page * PER_PAGE;
    const slice = products.slice(start, start + PER_PAGE);
    if (slice[0])
      await drawHero(
        doc,
        data,
        slice[0],
        photos[start],
        left,
        top,
        contentWidth,
        heroHeight,
      );
    for (let i = 1; i < slice.length; i++) {
      const col = (i - 1) % 3;
      const row = Math.floor((i - 1) / 3);
      await drawCard(
        doc,
        data,
        slice[i],
        photos[start + i],
        left + col * (colWidth + colGap),
        rowTop + row * (rowHeight + gap),
        colWidth,
        rowHeight,
      );
    }
    // Последняя страница не остаётся полупустой: остаток ряда занимает
    // плашка «Не нашли нужное?», а следующий пустой ряд — услуги цеха.
    const cards = Math.max(0, slice.length - 1);
    let bannerDrawn = false;
    for (let row = 0; row < 2; row++) {
      const filled = Math.max(0, Math.min(3, cards - row * 3));
      if (filled === 3) continue;
      const y = rowTop + row * (rowHeight + gap);
      const x = left + filled * (colWidth + colGap);
      const width = contentWidth - filled * (colWidth + colGap);
      if (!bannerDrawn) {
        await drawBanner(doc, data, x, y, width, rowHeight);
        bannerDrawn = true;
      } else drawServices(doc, x, y, width, rowHeight);
    }
    drawPageFooter(doc, data);
  }

  doc.addPage();
  await drawBackCover(doc, data);
  doc.end();
  return result;
}
