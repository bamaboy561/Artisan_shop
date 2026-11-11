// Проект Базис-Мебельщик узнаём по первым байтам «BZ85», а не по имени:
// с телефона файл часто приходит из WhatsApp или Telegram без «.b3d».

// Телефоны не знают тип .b3d. iPhone и часть Android из-за этого делают
// такие файлы серыми в окне выбора, поэтому вместе с расширением
// разрешаем «любой двоичный файл», и проект можно выбрать.
export const BAZIS_FILE_ACCEPT = ".b3d,application/octet-stream";

export function withBazisAccept(accept: string) {
  return `${accept},application/octet-stream`;
}

export function hasBazisExtension(fileName: string) {
  return /\.b3d$/i.test(fileName);
}

export async function isBazisFile(file: File) {
  if (hasBazisExtension(file.name)) return true;
  if (file.size < 32) return false;

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...head) === "BZ85";
}

// Возвращает тот же файл, а если это проект Базиса без «.b3d» в имени,
// копию с расширением: по нему заявка, предпросмотр и Giblab находят проект.
export async function withBazisExtension(file: File) {
  if (hasBazisExtension(file.name) || !(await isBazisFile(file))) {
    return file;
  }

  // Android иногда дописывает «.bin», его меняем на «.b3d».
  const baseName = file.name.trim().replace(/\.(bin|dat)$/i, "") || "проект";
  return new File([file], `${baseName}.b3d`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export function withBazisExtensions(files: File[]) {
  return Promise.all(files.map(withBazisExtension));
}
