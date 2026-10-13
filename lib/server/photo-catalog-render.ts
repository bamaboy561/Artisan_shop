import "server-only";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { PhotoCatalogData } from "@/lib/server/photo-catalog-data";
import { catalogThumbnail } from "@/lib/server/catalog-thumbnail";

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
// страниц разделов. Страница 1 — обложка, товары начинаются со второй.
export function layoutPhotoCatalog(products: CatalogProduct[]): CatalogLayout {
  const layout: CatalogLayout = { pages: 1, sections: [], cards: [] };
  let page = 1;
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

  // Обложка: название, фото, содержание и контакты.
  doc.rect(0, 0, PAGE.width, 372).fill(COLORS.ink);
  doc
    .font("bold")
    .fontSize(40)
    .fillColor("#ffffff")
    .text("ARTISAN", PAGE.margin + 8, 64, { characterSpacing: 4 });
  doc
    .font("regular")
    .fontSize(13)
    .fillColor("#c9d3ce")
    .text("Каталог материалов и фурнитуры", PAGE.margin + 8, 118);
  doc
    .font("bold")
    .fontSize(22)
    .fillColor(COLORS.accent)
    .text(data.title, PAGE.margin + 8, 146, { width: 520, lineBreak: false });
  doc
    .font("regular")
    .fontSize(9)
    .fillColor("#c9d3ce")
    .text(
      `Цены и наличие на ${date} · Товаров: ${data.products.length} · Разделов: ${contents.length}`,
      PAGE.margin + 8,
      182,
    );
  const coverPhotos = photos.filter((photo): photo is Buffer => !!photo);
  const coverWidth = (PAGE.width - PAGE.margin * 2 - 16 - 2 * 10) / 3;
  coverPhotos.slice(0, 3).forEach((photo, index) => {
    const x = PAGE.margin + 8 + index * (coverWidth + 10);
    doc.save();
    doc.roundedRect(x, 214, coverWidth, 124, 8).clip();
    doc.rect(x, 214, coverWidth, 124).fill("#ffffff");
    doc.image(photo, x, 214, {
      cover: [coverWidth, 124],
      align: "center",
      valign: "center",
    });
    doc.restore();
  });

  doc
    .font("bold")
    .fontSize(14)
    .fillColor(COLORS.ink)
    .text("Содержание", PAGE.margin + 8, 396);
  const tocTop = 422;
  const tocBottom = 676;
  const tocColumns = contents.length > 14 ? 2 : 1;
  const tocWidth =
    (PAGE.width - PAGE.margin * 2 - 16 - (tocColumns - 1) * 20) / tocColumns;
  const tocRows = Math.floor((tocBottom - tocTop) / 17);
  const tocVisible =
    contents.length > tocRows * tocColumns
      ? tocRows * tocColumns - 1
      : contents.length;
  contents.slice(0, tocVisible).forEach((section, index) => {
    const x = PAGE.margin + 8 + Math.floor(index / tocRows) * (tocWidth + 20);
    const y = tocTop + (index % tocRows) * 17;
    doc.font("regular").fontSize(9).fillColor(COLORS.ink);
    const label = `${section.category} (${section.count})`;
    doc.text(label, x, y, {
      width: tocWidth - 34,
      height: 12,
      ellipsis: true,
      lineBreak: false,
    });
    doc
      .fillColor(COLORS.green)
      .text(String(section.page), x + tocWidth - 30, y, {
        width: 30,
        align: "right",
        lineBreak: false,
      });
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(x, y + 13.5)
      .lineTo(x + tocWidth, y + 13.5)
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
        tocTop + (tocRows - 1) * 17,
      );

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
  for (let page = 2; page <= layout.pages; page++) {
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
