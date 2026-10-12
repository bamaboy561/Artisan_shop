import "server-only";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
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

export async function renderPhotoPdf(
  data: PhotoCatalogData,
  photos: (Buffer | null)[],
) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 32,
    bufferPages: true,
    font: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const money = (value: number | null) =>
    value == null
      ? "Не указана"
      : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  function heading() {
    doc.fillColor("#176b5b").fontSize(20).text("ARTISAN", 32, 30);
    doc
      .fillColor("#222222")
      .fontSize(12)
      .text(data.title, 32, 62, { width: 531 });
    doc
      .fontSize(8)
      .fillColor("#666666")
      .text(
        `Каталог на ${data.createdAt.toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })} | Товаров: ${data.products.length}`,
        32,
        doc.y + 4,
      );
    return doc.y + 20;
  }
  let y = heading();
  data.products.forEach((product, index) => {
    const textWidth = 390;
    doc.fontSize(11);
    const nameHeight = doc.heightOfString(product.name, { width: textWidth });
    doc.fontSize(8);
    const detail = `${product.brand} | ${product.category}\nАртикул: ${product.sku}\n${catalogDimensions(product)}`;
    const detailHeight = doc.heightOfString(detail, { width: textWidth });
    const height = Math.max(114, nameHeight + detailHeight + 46);
    if (height > 640)
      throw new Error(
        "Слишком длинное описание товара для PDF. Скачайте Excel.",
      );
    if (y + height > 782) {
      doc.addPage();
      y = heading();
    }
    if (photos[index])
      doc.image(photos[index]!, 32, y + 6, {
        fit: [120, 90],
        align: "center",
        valign: "center",
      });
    else
      doc
        .fillColor("#777777")
        .fontSize(8)
        .text("Фото недоступно", 32, y + 40, { width: 120, align: "center" });
    doc
      .fillColor("#222222")
      .fontSize(11)
      .text(product.name, 170, y + 6, { width: textWidth });
    doc
      .fillColor("#666666")
      .fontSize(8)
      .text(detail, 170, doc.y + 5, { width: textWidth });
    doc
      .fillColor("#176b5b")
      .fontSize(10)
      .text(
        `Цена: ${money(product.price)} сом    Остаток: ${product.stockQuantity ?? "Не указан"}`,
        170,
        doc.y + 7,
        { width: textWidth },
      );
    y += height;
    doc.strokeColor("#dce5e2").moveTo(32, y).lineTo(563, y).stroke();
    y += 8;
  });
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor("#666666")
      .fontSize(8)
      .text(`${i + 1} / ${pages.count}`, 32, 790, {
        width: 531,
        align: "right",
        lineBreak: false,
      });
  }
  doc.end();
  return result;
}
