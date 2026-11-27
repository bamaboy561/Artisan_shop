import "server-only";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { PhotoCatalogData } from "@/lib/server/photo-catalog-data";
import { catalogThumbnail } from "@/lib/server/catalog-thumbnail";
import {
  ARTISAN_LOGO_COLOR,
  artisanLogoLayout,
  type ArtisanLogoVariant,
} from "@/lib/brand/artisan-logo-paths";

export function catalogDimensions(
  product: PhotoCatalogData["products"][number],
) {
  return [
    product.format,
    product.thicknessMm != null ? `${product.thicknessMm} мм` : null,
    product.edgeThicknessMm != null
      ? `Кромка ${product.edgeThicknessMm} мм`
      : null,
    product.edgeWidthMm != null ? `Ширина ${product.edgeWidthMm} мм` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

export async function loadCatalogPhotos(data: PhotoCatalogData) {
  const photos: (Buffer | null)[] = new Array(data.products.length).fill(null);
  const deadline = Date.now() + 90_000;
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < data.products.length) {
        const current = index++;
        if (Date.now() > deadline)
          throw new Error(
            "Выгрузка слишком большая. Выберите отдельный бренд.",
          );
        photos[current] = await catalogThumbnail(
          data.products[current].imageUrl,
        );
      }
    }),
  );
  return photos;
}

// Логотип выбранного бренда для титульной — крупнее миниатюр товаров.
export async function loadCatalogLogo(data: PhotoCatalogData) {
  return data.brandLogoUrl
    ? catalogThumbnail(data.brandLogoUrl, [480, 240])
    : null;
}

export async function renderPhotoExcel(
  data: PhotoCatalogData,
  photos: (Buffer | null)[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Artisan";
  workbook.created = data.createdAt;
  const sheet = workbook.addWorksheet("Каталог", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  sheet.columns = [
    { width: 24 },
    { width: 26 },
    { width: 48 },
    { width: 20 },
    { width: 38 },
    { width: 28 },
    { width: 16 },
    { width: 14 },
  ];
  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = `ARTISAN | ${data.title}`;
  sheet.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: "FF176B5B" },
  };
  sheet.getRow(1).height = 32;
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value =
    `Цены, сом. Остатки на ${data.createdAt.toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })}. Товаров: ${data.products.length}.`;
  sheet.addRow([
    "Фото",
    "Артикул",
    "Наименование",
    "Бренд",
    "Группа / категория",
    "Размеры / толщина",
    "Цена, сом",
    "Остаток",
  ]);
  sheet.getRow(3).height = 26;
  sheet.getRow(3).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF176B5B" },
    };
  });
  data.products.forEach((product, index) => {
    const row = sheet.addRow([
      photos[index] ? "" : "Фото недоступно",
      product.sku,
      product.name,
      product.brand,
      product.category,
      catalogDimensions(product),
      product.price,
      product.stockQuantity,
    ]);
    row.height = 96;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      if (index % 2 === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F6F5" },
        };
    });
    row.getCell(2).numFmt = "@";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(8).numFmt = "#,##0.###";
    if (photos[index]) {
      const id = workbook.addImage({
        base64: photos[index]!.toString("base64"),
        extension: "jpeg",
      });
      sheet.addImage(id, {
        tl: { col: 0.1, row: row.number - 0.9 },
        ext: { width: 144, height: 108 },
        editAs: "oneCell",
      });
    }
  });
  sheet.autoFilter = `A3:H${Math.max(3, data.products.length + 3)}`;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:3",
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PAGE = { width: 595.28, height: 841.89, margin: 28 };
const COLORS = {
  ink: "#1f2b25",
  green: "#176b5b",
  muted: "#6b6b66",
  line: "#e4dfd6",
  paper: "#f7f4ef",
  photo: "#f2efe9",
  accent: "#c98a6b",
  sale: "#b4432f",
};
const COVER = {
  background: "#171613",
  footer: "#0f0e0c",
  text: "#d8d2c8",
  muted: "#9a9388",
  line: "#3a3631",
  watermark: "#1e1c19",
};

// Логотип Artisan (горизонт.pdf) — те же контуры, что на сайте.
function drawArtisanLogo(
  doc: InstanceType<typeof PDFDocument>,
  variant: ArtisanLogoVariant,
  x: number,
  y: number,
  height: number,
  color: string,
) {
  const layout = artisanLogoLayout(variant);
  const k = height / layout.height;
  doc.save();
  doc.translate(x, y).scale(k);
  for (const part of layout.parts) {
    doc.save();
    doc.translate(part.x, part.y).scale(part.scale);
    for (const d of part.paths) doc.path(d).fill(color);
    doc.restore();
  }
  doc.restore();
  return layout.width * k;
}

const GRID = {
  columns: 3,
  gap: 12,
  cardHeight: 224,
  photoHeight: 116,
  sectionHeight: 36,
  top: 54,
  bottom: PAGE.height - 40,
};
const CARD_WIDTH =
  (PAGE.width - PAGE.margin * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns;

type CatalogProduct = PhotoCatalogData["products"][number];
type CatalogLayout = {
  pages: number;
  sections: {
    category: string;
    count: number;
    page: number;
    y: number;
    continued: boolean;
  }[];
  cards: { index: number; page: number; x: number; y: number }[];
};

// Разделы каталога — верхний уровень категорий («Плиты», «Фурнитура»),
// подкатегория пишется на карточке: мелкие разделы не тратят страниц.
export function catalogSection(product: { category: string }) {
  return product.category.split(" / ")[0] || "Без категории";
}

// Раскладка считается заранее: так в содержании на обложке есть номера
// страниц разделов. Страница 1 — титульная, 2 — содержание, товары с третьей.
export function layoutPhotoCatalog(products: CatalogProduct[]): CatalogLayout {
  const layout: CatalogLayout = { pages: 2, sections: [], cards: [] };
  let page = 2;
  let y = GRID.bottom;
  let column = GRID.columns;
  const rowHeight = GRID.cardHeight + GRID.gap;
  products.forEach((product, index) => {
    const section = catalogSection(product);
    const previous = products[index - 1];
    if (!previous || catalogSection(previous) !== section) {
      // Раздел не начинается внизу страницы без единой строки карточек.
      if (column > 0) y += rowHeight;
      if (y + GRID.sectionHeight + GRID.cardHeight > GRID.bottom) {
        page++;
        y = GRID.top;
      }
      layout.sections.push({
        category: section,
        count: products.filter((item) => catalogSection(item) === section)
          .length,
        page,
        y,
        continued: false,
      });
      y += GRID.sectionHeight;
      column = 0;
    } else if (column === GRID.columns) {
      y += rowHeight;
      column = 0;
    }
    if (column === 0 && y + GRID.cardHeight > GRID.bottom) {
      page++;
      y = GRID.top;
      // Раздел продолжается на новой странице: повторяем его заголовок.
      const current = layout.sections[layout.sections.length - 1];
      layout.sections.push({ ...current, page, y, continued: true });
      y += GRID.sectionHeight;
    }
    layout.cards.push({
      index,
      page,
      x: PAGE.margin + column * (CARD_WIDTH + GRID.gap),
      y,
    });
    column++;
  });
  layout.pages = page;
  return layout;
}

export async function renderPhotoPdf(
  data: PhotoCatalogData,
  photos: (Buffer | null)[],
  brandLogo: Buffer | null = null,
) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    autoFirstPage: true,
    info: { Title: `Artisan — ${data.title}`, Author: "Artisan" },
  });
  const fonts = path.join(process.cwd(), "public/fonts");
  doc.registerFont("regular", path.join(fonts, "NotoSans-Regular.ttf"));
  doc.registerFont("bold", path.join(fonts, "NotoSans-Bold.ttf"));
  doc.font("regular");
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const money = (value: number) =>
    `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} сом`;
  const date = data.createdAt.toLocaleDateString("ru-RU", {
    timeZone: "Asia/Bishkek",
  });
  const site = data.siteUrl.replace(/^https?:\/\//, "");
  const layout = layoutPhotoCatalog(data.products);
  const contents = layout.sections.filter((section) => !section.continued);
  const qr = (url: string) =>
    QRCode.toBuffer(url, {
      margin: 0,
      width: 132,
      errorCorrectionLevel: "L",
      color: { dark: COLORS.ink, light: "#ffffff" },
    });

  // Страница 1 — титульная: логотип, название каталога, образцы, контакты.
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COVER.background);
  // Большой знак Artisan — фоном справа, заполняет пустое место.
  drawArtisanLogo(doc, "mark", PAGE.width - 400, 250, 330, COVER.watermark);

  const left = PAGE.margin + 12;
  const right = PAGE.width - PAGE.margin - 12;
  drawArtisanLogo(doc, "horizontal", left, 46, 46, "#ffffff");
  doc
    .font("regular")
    .fontSize(8)
    .fillColor(COVER.muted)
    .text("КАТАЛОГ", right - 120, 52, {
      width: 120,
      align: "right",
      characterSpacing: 2,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(16)
    .fillColor(COLORS.accent)
    .text(String(data.createdAt.getFullYear()), right - 120, 64, {
      width: 120,
      align: "right",
      lineBreak: false,
    });
  doc
    .strokeColor(COVER.line)
    .lineWidth(0.6)
    .moveTo(left, 110)
    .lineTo(right, 110)
    .stroke();

  doc
    .font("bold")
    .fontSize(9)
    .fillColor(COLORS.accent)
    .text("ФОТОКАТАЛОГ С ЦЕНАМИ", left, 158, {
      characterSpacing: 3,
      lineBreak: false,
    });
  doc.font("bold").fontSize(data.title.length > 18 ? 36 : 48);
  const titleOptions = {
    width: right - left - (brandLogo ? 170 : 0),
    height: 120,
    ellipsis: true,
  };
  doc.fillColor("#ffffff").text(data.title, left, 176, titleOptions);
  let coverY =
    176 + Math.min(120, doc.heightOfString(data.title, titleOptions));
  doc.rect(left, coverY + 14, 56, 3).fill(COLORS.accent);
  doc
    .font("regular")
    .fontSize(12)
    .fillColor(COVER.text)
    .text(
      contents.map((section) => section.category).join(" · "),
      left,
      coverY + 30,
      { width: right - left, height: 34, ellipsis: true, lineGap: 2 },
    );

  // Логотип бренда — на белой плашке справа от названия.
  if (brandLogo) {
    const plate = { width: 150, height: 76 };
    const plateX = right - plate.width;
    const plateY = 160;
    doc
      .roundedRect(plateX, plateY, plate.width, plate.height, 8)
      .fill("#ffffff");
    doc.image(brandLogo, plateX + 12, plateY + 10, {
      fit: [plate.width - 24, plate.height - 20],
      align: "center",
      valign: "center",
    });
  }

  // Образцы — фото первых товаров плиткой, как доска с декорами.
  const coverPhotos = photos.filter((photo): photo is Buffer => !!photo);
  const tileGap = 8;
  const tileWidth = (right - left - tileGap * 2) / 3;
  const tileHeight = 118;
  const tileRows =
    coverPhotos.length >= 6 ? 2 : coverPhotos.length >= 3 ? 1 : 0;
  const tilesTop = 656 - tileRows * tileHeight - (tileRows - 1) * tileGap;
  coverPhotos.slice(0, tileRows * 3).forEach((photo, i) => {
    const x = left + (i % 3) * (tileWidth + tileGap);
    const y = tilesTop + Math.floor(i / 3) * (tileHeight + tileGap);
    doc.save();
    doc.roundedRect(x, y, tileWidth, tileHeight, 6).clip();
    doc.rect(x, y, tileWidth, tileHeight).fill("#ffffff");
    doc.image(photo, x, y, {
      cover: [tileWidth, tileHeight],
      align: "center",
      valign: "center",
    });
    doc.restore();
  });
  if (!tileRows) {
    // Без фото — коротко о том, что ещё делает Artisan.
    [
      "Распил и кромление",
      "Присадка и фрезеровка",
      "Расчёт распила онлайн",
    ].forEach((label, i) => {
      const x = left + i * (tileWidth + tileGap);
      doc.rect(x, 600, 24, 2).fill(COLORS.accent);
      doc
        .font("regular")
        .fontSize(10)
        .fillColor(COVER.text)
        .text(label, x, 612, { width: tileWidth, lineBreak: false });
    });
  }

  // Нижняя полоса: дата цен, телефон, QR на сайт.
  const footerY = 690;
  doc.rect(0, footerY, PAGE.width, PAGE.height - footerY).fill(COVER.footer);
  doc.rect(0, footerY, PAGE.width, 3).fill(COLORS.accent);
  doc
    .font("regular")
    .fontSize(8)
    .fillColor(COVER.muted)
    .text("ЦЕНЫ И НАЛИЧИЕ НА", left, footerY + 30, {
      characterSpacing: 1.5,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(16)
    .fillColor("#ffffff")
    .text(date, left, footerY + 44, { lineBreak: false });
  doc
    .font("regular")
    .fontSize(9)
    .fillColor(COVER.text)
    .text(
      `Товаров: ${data.products.length} · Разделов: ${contents.length}`,
      left,
      footerY + 70,
      { lineBreak: false },
    );
  const contactX = left + 175;
  doc
    .font("regular")
    .fontSize(8)
    .fillColor(COVER.muted)
    .text("ЗАКАЗ И КОНСУЛЬТАЦИЯ", contactX, footerY + 30, {
      characterSpacing: 1.5,
      lineBreak: false,
    });
  doc
    .font("bold")
    .fontSize(16)
    .fillColor("#ffffff")
    .text(data.contacts.phone, contactX, footerY + 44, { lineBreak: false });
  doc
    .font("regular")
    .fontSize(9)
    .fillColor(COVER.text)
    .text(`WhatsApp · ${site}`, contactX, footerY + 70, { lineBreak: false });
  const qrBox = 92;
  const qrX = right - qrBox;
  doc.roundedRect(qrX, footerY + 22, qrBox, qrBox, 8).fill("#ffffff");
  doc.image(await qr(data.siteUrl), qrX + 12, footerY + 30, { width: 68 });
  doc
    .font("regular")
    .fontSize(6.5)
    .fillColor(COLORS.muted)
    .text("Каталог онлайн", qrX, footerY + 100, {
      width: qrBox,
      align: "center",
      lineBreak: false,
    });
  doc.link(qrX, footerY + 22, qrBox, qrBox, data.siteUrl);

  // Страница 2 — содержание и контакты.
  doc.addPage({ size: "A4", margin: 0 });
  drawArtisanLogo(doc, "compact", PAGE.margin + 8, 44, 22, ARTISAN_LOGO_COLOR);
  doc
    .font("bold")
    .fontSize(26)
    .fillColor(COLORS.ink)
    .text("Содержание", PAGE.margin + 8, 104);
  doc.rect(PAGE.margin + 8, 142, 40, 3).fill(COLORS.accent);
  const tocTop = 166;
  // Мало разделов — внизу остаётся место под услуги производства.
  const showServices = contents.length <= 16;
  const tocBottom = showServices ? 500 : 676;
  const tocColumns = contents.length > 26 ? 2 : 1;
  const tocWidth =
    (PAGE.width - PAGE.margin * 2 - 16 - (tocColumns - 1) * 20) / tocColumns;
  const tocStep = 19;
  const tocRows = Math.floor((tocBottom - tocTop) / tocStep);
  const tocVisible =
    contents.length > tocRows * tocColumns
      ? tocRows * tocColumns - 1
      : contents.length;
  contents.slice(0, tocVisible).forEach((section, index) => {
    const x = PAGE.margin + 8 + Math.floor(index / tocRows) * (tocWidth + 20);
    const y = tocTop + (index % tocRows) * tocStep;
    doc.font("regular").fontSize(10).fillColor(COLORS.ink);
    const label = `${section.category} (${section.count})`;
    doc.text(label, x, y, {
      width: tocWidth - 34,
      height: 13,
      ellipsis: true,
      lineBreak: false,
    });
    doc
      .font("bold")
      .fillColor(COLORS.green)
      .text(String(section.page), x + tocWidth - 30, y, {
        width: 30,
        align: "right",
        lineBreak: false,
      });
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(x, y + 15)
      .lineTo(x + tocWidth, y + 15)
      .stroke();
  });
  if (tocVisible < contents.length)
    doc
      .font("regular")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        `и ещё разделов: ${contents.length - tocVisible}`,
        PAGE.margin + 8 + (tocColumns - 1) * (tocWidth + 20),
        tocTop + (tocRows - 1) * tocStep,
      );

  if (showServices) {
    doc
      .font("bold")
      .fontSize(14)
      .fillColor(COLORS.ink)
      .text("Производство Artisan", PAGE.margin + 8, 520);
    const services = [
      ["Распил", "Плиты режем на немецком оборудовании — ровно и без сколов."],
      ["Кромление", "Кромка на PUR-клей: держится и не боится влаги."],
      [
        "Присадка и фрезеровка",
        "Отверстия под петли, конфирматы и пазы — по вашему проекту.",
      ],
      ["Онлайн на сайте", "Калькулятор распила и 3D-конструктор мебели."],
    ];
    const cardWidth = (PAGE.width - PAGE.margin * 2 - 12) / 2;
    services.forEach(([name, text], i) => {
      const x = PAGE.margin + (i % 2) * (cardWidth + 12);
      const y = 546 + Math.floor(i / 2) * 68;
      doc
        .roundedRect(x, y, cardWidth, 58, 8)
        .lineWidth(0.6)
        .strokeColor(COLORS.line)
        .stroke();
      doc.rect(x + 14, y + 14, 3, 12).fill(COLORS.accent);
      doc
        .font("bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text(name, x + 24, y + 12, {
          width: cardWidth - 36,
          lineBreak: false,
        });
      doc
        .font("regular")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(text, x + 24, y + 28, {
          width: cardWidth - 36,
          height: 24,
          ellipsis: true,
        });
    });
  }

  const contactsY = 700;
  doc
    .roundedRect(PAGE.margin, contactsY, PAGE.width - PAGE.margin * 2, 112, 10)
    .fill(COLORS.paper);
  doc
    .font("bold")
    .fontSize(15)
    .fillColor(COLORS.ink)
    .text(data.contacts.phone, PAGE.margin + 18, contactsY + 16);
  doc
    .font("regular")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      [
        `WhatsApp: ${data.contacts.phone}`,
        data.contacts.address,
        data.contacts.hours,
        `${site} · ${data.contacts.email}`,
      ].join("\n"),
      PAGE.margin + 18,
      contactsY + 40,
      { lineGap: 2 },
    );
  doc.image(
    await qr(data.siteUrl),
    PAGE.width - PAGE.margin - 96,
    contactsY + 14,
    {
      width: 68,
    },
  );
  doc
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text("Каталог онлайн", PAGE.width - PAGE.margin - 110, contactsY + 88, {
      width: 96,
      align: "center",
    });

  // Страницы товаров.
  for (let page = 3; page <= layout.pages; page++) {
    doc.addPage({ size: "A4", margin: 0 });
    doc
      .font("bold")
      .fontSize(11)
      .fillColor(COLORS.green)
      .text("ARTISAN", PAGE.margin, 22, { characterSpacing: 2 });
    doc
      .font("regular")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`${data.title} · цены на ${date}`, PAGE.margin, 25, {
        width: PAGE.width - PAGE.margin * 2,
        align: "right",
        lineBreak: false,
      });
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.6)
      .moveTo(PAGE.margin, 42)
      .lineTo(PAGE.width - PAGE.margin, 42)
      .stroke();
    for (const section of layout.sections.filter(
      (item) => item.page === page,
    )) {
      doc
        .rect(PAGE.margin, section.y + 6, 3, 16)
        .fill(COLORS.accent)
        .font("bold")
        .fontSize(14)
        .fillColor(COLORS.ink)
        .text(
          section.continued
            ? `${section.category} · продолжение`
            : section.category,
          PAGE.margin + 10,
          section.y + 3,
          {
            width: 440,
            height: 20,
            ellipsis: true,
            lineBreak: false,
          },
        );
      doc
        .font("regular")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`${section.count} шт.`, PAGE.margin, section.y + 9, {
          width: PAGE.width - PAGE.margin * 2,
          align: "right",
          lineBreak: false,
        });
    }
    for (const card of layout.cards.filter((item) => item.page === page)) {
      const product = data.products[card.index];
      const photo = photos[card.index];
      const { x, y } = card;
      const inner = CARD_WIDTH - 16;
      doc
        .roundedRect(x, y, CARD_WIDTH, GRID.cardHeight, 8)
        .lineWidth(0.6)
        .strokeColor(COLORS.line)
        .stroke();
      doc.save();
      doc.roundedRect(x, y, CARD_WIDTH, GRID.photoHeight, 8).clip();
      doc.rect(x, y, CARD_WIDTH, GRID.photoHeight).fill(COLORS.photo);
      if (photo)
        doc.image(photo, x + 6, y + 6, {
          fit: [CARD_WIDTH - 12, GRID.photoHeight - 12],
          align: "center",
          valign: "center",
        });
      else
        doc
          .font("regular")
          .fontSize(8)
          .fillColor(COLORS.muted)
          .text("Фото скоро будет", x, y + GRID.photoHeight / 2 - 5, {
            width: CARD_WIDTH,
            align: "center",
          });
      doc.restore();
      if (product.oldPrice && product.price) {
        const percent = Math.round(
          (1 - product.price / product.oldPrice) * 100,
        );
        if (percent > 0) {
          doc.roundedRect(x + 8, y + 8, 38, 16, 8).fill(COLORS.sale);
          doc
            .font("bold")
            .fontSize(8)
            .fillColor("#ffffff")
            .text(`−${percent}%`, x + 8, y + 11.5, {
              width: 38,
              align: "center",
              lineBreak: false,
            });
        }
      }

      const subcategory = product.category.split(" / ").slice(1).join(" / ");
      let textY = y + GRID.photoHeight + 8;
      doc
        .font("regular")
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(
          [product.brand.toUpperCase(), subcategory]
            .filter(Boolean)
            .join(" · "),
          x + 8,
          textY,
          { width: inner, height: 9, ellipsis: true, lineBreak: false },
        );
      textY += 11;
      doc.font("bold").fontSize(8.6).fillColor(COLORS.ink);
      const nameOptions = {
        width: inner,
        height: 36,
        ellipsis: true,
        lineGap: 0.5,
      };
      doc.text(product.name, x + 8, textY, nameOptions);
      textY += Math.min(36, doc.heightOfString(product.name, nameOptions)) + 3;
      doc
        .font("regular")
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(
          [`Арт. ${product.sku}`, catalogDimensions(product)]
            .filter(Boolean)
            .join(" · "),
          x + 8,
          textY,
          { width: inner, height: 20, ellipsis: true, lineGap: 0.5 },
        );

      const bottom = y + GRID.cardHeight;
      const qrSize = 34;
      doc.image(
        await qr(product.url),
        x + CARD_WIDTH - 8 - qrSize,
        bottom - 8 - qrSize,
        { width: qrSize },
      );
      const priceWidth = inner - qrSize - 6;
      if (product.price != null) {
        const priceText = money(product.price);
        doc
          .font("bold")
          .fontSize(product.price >= 100000 ? 11 : 13)
          .fillColor(COLORS.green)
          .text(priceText, x + 8, bottom - 42, {
            width: priceWidth,
            lineBreak: false,
          });
        const priceEnd = x + 8 + doc.widthOfString(priceText) + 6;
        if (product.oldPrice && priceEnd < x + 8 + priceWidth - 20)
          doc
            .font("regular")
            .fontSize(7.5)
            .fillColor(COLORS.muted)
            .text(money(product.oldPrice), priceEnd, bottom - 37, {
              width: x + 8 + priceWidth - priceEnd,
              strike: true,
              lineBreak: false,
            });
      } else
        doc
          .font("bold")
          .fontSize(10)
          .fillColor(COLORS.ink)
          .text("Цена по запросу", x + 8, bottom - 40, {
            width: priceWidth,
            lineBreak: false,
          });
      // Количество неизвестно, но наличие отмечено вручную — как на витрине.
      const quantity = product.stockQuantity;
      const inStock =
        quantity != null
          ? quantity > 0
          : product.inventoryStatus === "IN_STOCK" ||
            product.inventoryStatus === "LIMITED";
      doc
        .circle(x + 11, bottom - 13.5, 2.2)
        .fill(inStock ? COLORS.green : COLORS.accent);
      doc
        .font("regular")
        .fontSize(7)
        .fillColor(inStock ? COLORS.green : COLORS.muted)
        .text(
          !inStock
            ? "Под заказ"
            : quantity != null
              ? `В наличии: ${quantity.toLocaleString("ru-RU")}`
              : "В наличии",
          x + 17,
          bottom - 17.5,
          { width: priceWidth - 9, lineBreak: false },
        );
      doc.link(x, y, CARD_WIDTH, GRID.cardHeight, product.url);
    }
  }

  const pages = doc.bufferedPageRange();
  for (let i = 1; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .font("regular")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`${data.contacts.phone} · ${site}`, PAGE.margin, PAGE.height - 26, {
        lineBreak: false,
      })
      .text(`${i + 1} / ${pages.count}`, PAGE.margin, PAGE.height - 26, {
        width: PAGE.width - PAGE.margin * 2,
        align: "right",
        lineBreak: false,
      });
  }
  doc.end();
  return result;
}
