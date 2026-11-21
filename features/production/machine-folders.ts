// Связь программы цеха (GibLab → постпроцессоры → сетевые папки станков) с
// сайтом. На компьютере цеха работает маленький наблюдатель (PowerShell,
// без установки): раз в минуту присылает список файлов в каждой папке.
// Сайт сравнивает со своим списком: новый файл — «передан на станок»,
// файл исчез — «снят со станка». Здесь только чистая логика без базы.

// «cutting» — папка пилы: файл появился → заявка «Распил», все файлы заявки
// убраны из папок пилы → «Кромка». Пусто — только показываем.
export type MachineFolderStage = "cutting" | "";

export type MachineFolder = {
  id: string;
  name: string;
  path: string;
  stage: MachineFolderStage;
  // Смотреть и вложенные папки. По умолчанию нет: в папках станков часто
  // лежат архивы старых программ.
  recurse: boolean;
};

export type ReportedFile = {
  name: string;
  size: number | null;
  modifiedAt: Date | null;
};

export type ReportedFolder = {
  id: string;
  ok: boolean;
  // Список неполный (файлов больше лимита): по нему нельзя судить, что
  // файл убран.
  truncated?: boolean;
  files: ReportedFile[];
};

export type WatcherReport = {
  computer: string | null;
  folders: ReportedFolder[];
};

export const maxMachineFolders = 6;
export const maxFilesPerFolder = 1000;
export const watcherIntervalSeconds = 60;
// Наблюдатель молчит дольше этого — показываем «нет связи».
export const watcherStaleMinutes = 5;

// Пути из настроек постпроцессоров GibLab в цеху (фото Султана 2026-11-21).
export const defaultMachineFolders: MachineFolder[] = [
  {
    id: "holzma",
    name: "HOLZMA (раскрой)",
    path: "\\\\M0341871836M701\\HolzmaKroy",
    stage: "cutting",
    recurse: false,
  },
  {
    id: "altendorf",
    name: "Altendorf",
    path: "Z:\\",
    stage: "cutting",
    recurse: false,
  },
  {
    id: "excitech",
    name: "Excitech (присадка)",
    path: "\\\\DESKTOP-186\\drill_work",
    stage: "",
    recurse: false,
  },
];

function cleanText(value: unknown, max: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";
}

export function cleanFolderId(value: unknown) {
  return cleanText(value, 40)
    .replace(/[^a-z0-9_-]/gi, "")
    .toLowerCase();
}

// Настройки папок хранятся одной строкой JSON.
export function parseMachineFolders(raw: string | null | undefined) {
  if (!raw) return defaultMachineFolders;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultMachineFolders;
    return normalizeMachineFolders(parsed);
  } catch {
    return defaultMachineFolders;
  }
}

export function normalizeMachineFolders(items: unknown[]) {
  const seen = new Set<string>();
  const result: MachineFolder[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = cleanText(record.name, 60);
    const path = cleanText(record.path, 400);
    let id = cleanFolderId(record.id);
    if (!name && !path) continue;
    if (!id || seen.has(id)) id = `m${Date.now().toString(36)}${result.length}`;
    seen.add(id);
    result.push({
      id,
      name: name || `Станок ${result.length + 1}`,
      path,
      stage: record.stage === "cutting" ? "cutting" : "",
      recurse: record.recurse === true || record.recurse === "on",
    });
    if (result.length >= maxMachineFolders) break;
  }
  return result;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// PowerShell 5 превращает массив из одного элемента в объект, а пустой — в
// null: принимаем все варианты.
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

export function parseWatcherReport(body: unknown): WatcherReport | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const folders: ReportedFolder[] = [];
  for (const item of asArray(record.folders).slice(0, maxMachineFolders * 2)) {
    if (!item || typeof item !== "object") continue;
    const folder = item as Record<string, unknown>;
    const id = cleanFolderId(folder.id);
    if (!id) continue;
    const names = new Set<string>();
    const files: ReportedFile[] = [];
    const entries = asArray(folder.files);
    let truncated = folder.truncated === true;
    for (const entry of entries) {
      if (files.length >= maxFilesPerFolder) {
        truncated = true;
        break;
      }
      if (!entry || typeof entry !== "object") continue;
      const file = entry as Record<string, unknown>;
      const name = cleanText(file.name, 300).replace(/\//g, "\\");
      if (!name || names.has(name.toLowerCase())) continue;
      names.add(name.toLowerCase());
      const size = Number(file.size);
      files.push({
        name,
        size: Number.isFinite(size) && size >= 0 ? Math.round(size) : null,
        modifiedAt: parseDate(file.modified),
      });
    }
    folders.push({ id, ok: folder.ok !== false, truncated, files });
  }
  return { computer: cleanText(record.computer, 80) || null, folders };
}

// Номер заявки сайта — «R-2045». В имени файла ищем R-2045, R2045, R_2045,
// «№2045» или «заявка 2045». Голые числа не берём: это часто размеры (2750).
export function findRequestNumbers(fileName: string) {
  const base = fileName.split("\\").pop() ?? fileName;
  const found: string[] = [];
  const add = (digits: string) => {
    const number = `R-${digits.padStart(4, "0")}`;
    if (!found.includes(number)) found.push(number);
  };
  for (const source of [base, fileName]) {
    for (const match of source.matchAll(
      /(?:^|[^a-zа-яё0-9])(?:r|р)[\s_-]?(\d{3,6})(?!\d)/giu,
    ))
      add(match[1]);
    for (const match of source.matchAll(
      /(?:№|n°|заявк[аи]?|заказ|zayavk[ai]?|zajavk[ai]?|zakaz)\s*[-_]?\s*(\d{3,6})(?!\d)/giu,
    ))
      add(match[1]);
  }
  return found;
}

const translit: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "u",
  я: "a",
};

// «Скелет» слова: GibLab транслитерирует имена файлов латиницей, а как
// именно — неизвестно (Виталий → Vitaliy / Vitalij / Vitalii). Сводим
// кириллицу и латиницу к одному виду, чтобы сравнить имя клиента.
export function nameSkeleton(value: string) {
  return [...value.toLowerCase()]
    .map((ch) => translit[ch] ?? ch)
    .join("")
    .replace(/kh/g, "h")
    .replace(/(ts|tz)/g, "c")
    .replace(/(yu|ju|iu)/g, "u")
    .replace(/(ya|ja|ia)/g, "a")
    .replace(/(yo|jo|ye|je)/g, "e")
    .replace(/[yj]/g, "i")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function nameWords(value: string) {
  return value
    .split(/[^a-zа-яё]+/iu)
    .map(nameSkeleton)
    .filter((word) => word.length >= 4);
}

// Если номера в имени файла нет, пробуем имя клиента: берём заявку, только
// если подходит ровно одна из открытых.
export function matchRequestByName<T extends { contactName: string }>(
  fileName: string,
  requests: T[],
) {
  const base = (fileName.split("\\").pop() ?? fileName).replace(/\.[^.]+$/, "");
  const fileWords = new Set(nameWords(base));
  if (!fileWords.size) return null;
  const hits = requests.filter((request) =>
    nameWords(request.contactName).some((word) => fileWords.has(word)),
  );
  return hits.length === 1 ? hits[0] : null;
}

// Старая версия программы присылает и файлы из подпапок: отбрасываем их,
// если для папки подпапки не включены.
export function filterTopLevel(folder: ReportedFolder): ReportedFolder {
  return {
    ...folder,
    files: folder.files.filter((file) => !file.name.includes("\\")),
  };
}

export type ActiveFileRow = {
  id: string;
  folderId: string;
  fileName: string;
};

export type FolderDiff = {
  added: ReportedFile[];
  kept: { id: string; file: ReportedFile }[];
  removedIds: string[];
};

// Сравнение: что на сайте числится в папке и что прислал наблюдатель.
// Если папка недоступна (ok=false), ничего не снимаем — иначе обрыв сети
// выглядел бы как «все файлы убраны».
export function diffFolder(
  active: ActiveFileRow[],
  reported: ReportedFolder,
): FolderDiff {
  const byName = new Map(
    active
      .filter((row) => row.folderId === reported.id)
      .map((row) => [row.fileName.toLowerCase(), row]),
  );
  const added: ReportedFile[] = [];
  const kept: FolderDiff["kept"] = [];
  for (const file of reported.files) {
    const row = byName.get(file.name.toLowerCase());
    if (row) {
      kept.push({ id: row.id, file });
      byName.delete(file.name.toLowerCase());
    } else added.push(file);
  }
  return {
    added: reported.ok ? added : [],
    kept,
    removedIds:
      reported.ok && !reported.truncated
        ? [...byName.values()].map((row) => row.id)
        : [],
  };
}

export function isWatcherStale(lastSeenAt: Date | null, now = new Date()) {
  return (
    !lastSeenAt ||
    now.getTime() - lastSeenAt.getTime() > watcherStaleMinutes * 60_000
  );
}

function psString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

// Файл .cmd, который запускает встроенный PowerShell-скрипт: двойной щелчок,
// ничего ставить не нужно. Папки берутся с сайта при каждом цикле, поэтому
// после смены пути на сайте файл перекачивать не надо.
export function buildWatcherScript(input: { siteUrl: string; key: string }) {
  const marker = "#PS" + "START";
  const ps = String.raw`
$ErrorActionPreference = 'Continue'
$Site = ${psString(input.siteUrl.replace(/\/+$/, ""))}
$Key = ${psString(input.key)}
$Api = "$Site/api/production/machine-folder"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Headers = @{ Authorization = "Bearer $Key" }
$Host.UI.RawUI.WindowTitle = 'Artisan - papki stankov'
Write-Host 'Artisan: slezhu za papkami stankov. Okno ne zakryvayte.' -ForegroundColor Green
$Loop = 0
$CatHash = ''
$CatDone = ''
while ($true) {
  $wait = ${watcherIntervalSeconds}
  try {
    $cfg = Invoke-RestMethod -Uri $Api -Headers $Headers -TimeoutSec 30
    if ($cfg.intervalSeconds) { $wait = [int]$cfg.intervalSeconds }
    $report = @()
    foreach ($f in @($cfg.folders)) {
      if (-not $f -or -not $f.path) { continue }
      $root = [string]$f.path
      $ok = Test-Path -LiteralPath $root
      $files = @()
      $truncated = $false
      if ($ok) {
        $prefix = (Get-Item -LiteralPath $root).FullName.TrimEnd('\') + '\'
        if ($f.recurse) { $all = @(Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue) }
        else { $all = @(Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue) }
        $truncated = $all.Count -gt ${maxFilesPerFolder}
        $items = @($all | Sort-Object LastWriteTime -Descending | Select-Object -First ${maxFilesPerFolder})
        foreach ($i in $items) {
          $rel = $i.FullName
          if ($rel.StartsWith($prefix)) { $rel = $rel.Substring($prefix.Length) }
          $files += @{ name = $rel; size = $i.Length; modified = $i.LastWriteTimeUtc.ToString('o') }
        }
      }
      $report += @{ id = $f.id; ok = $ok; truncated = $truncated; files = $files }
    }
    $json = ConvertTo-Json -InputObject @{ computer = $env:COMPUTERNAME; folders = $report } -Depth 6 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $null = Invoke-RestMethod -Uri $Api -Method Post -Headers $Headers -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 60
    Write-Host ((Get-Date -Format 'HH:mm:ss') + ' OK, papok: ' + $report.Count)
  } catch {
    Write-Host ((Get-Date -Format 'HH:mm:ss') + ' Oshibka: ' + $_.Exception.Message) -ForegroundColor Yellow
  }
  # Novye zakazy saita -> papka proektov GibLab (imena v base64: kirillica).
  try {
    $OrdersApi = "$Site/api/production/giblab-orders"
    $res = Invoke-RestMethod -Uri $OrdersApi -Headers $Headers -TimeoutSec 60
    $acks = @()
    foreach ($o in @($res.orders)) {
      if (-not $o -or -not $o.requestId) { continue }
      try {
        $u = [Text.Encoding]::UTF8
        $rootDir = $u.GetString([Convert]::FromBase64String([string]$o.root64))
        $folder = $u.GetString([Convert]::FromBase64String([string]$o.folder64))
        $name = $u.GetString([Convert]::FromBase64String([string]$o.fileName64))
        $dir = Join-Path $rootDir $folder
        if (-not (Test-Path -LiteralPath $dir)) { $null = [IO.Directory]::CreateDirectory($dir) }
        $file = Join-Path $dir $name
        if (Test-Path -LiteralPath $file) {
          $acks += @{ requestId = [string]$o.requestId; status = 'exists' }
        } else {
          [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String([string]$o.content))
          $acks += @{ requestId = [string]$o.requestId; status = 'written' }
          Write-Host ((Get-Date -Format 'HH:mm:ss') + ' GibLab: ' + $file) -ForegroundColor Cyan
        }
      } catch {
        $acks += @{ requestId = [string]$o.requestId; status = 'failed'; error = $_.Exception.Message }
      }
    }
    # Fail zakaza udalili v GibLab -> soobshaem saitu (klient peredumal).
    foreach ($w in @($res.watch)) {
      if (-not $w -or -not $w.requestId) { continue }
      try {
        $u = [Text.Encoding]::UTF8
        $rootDir = $u.GetString([Convert]::FromBase64String([string]$w.root64))
        if (-not (Test-Path -LiteralPath $rootDir)) { continue }
        $wf = Join-Path (Join-Path $rootDir ($u.GetString([Convert]::FromBase64String([string]$w.folder64)))) ($u.GetString([Convert]::FromBase64String([string]$w.fileName64)))
        if (-not (Test-Path -LiteralPath $wf)) { $acks += @{ requestId = [string]$w.requestId; status = 'missing' } }
      } catch {}
    }
    if ($acks.Count -gt 0) {
      $ackJson = ConvertTo-Json -InputObject @{ results = $acks } -Depth 4 -Compress
      $null = Invoke-RestMethod -Uri $OrdersApi -Method Post -Headers $Headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($ackJson)) -TimeoutSec 60
    }
  } catch {
    Write-Host ((Get-Date -Format 'HH:mm:ss') + ' GibLab oshibka: ' + $_.Exception.Message) -ForegroundColor Yellow
  }
  # Katalog materialov saita -> goods.xls dlya GibLab (raz v 10 ciklov).
  if (($Loop % 10) -eq 0) {
    try {
      $CatApi = "$Site/api/production/giblab-catalog"
      $cat = Invoke-RestMethod -Uri ($CatApi + '?hash=' + $CatHash) -Headers $Headers -TimeoutSec 60
      if ($cat.enabled -and $cat.path64) {
        $catPath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$cat.path64))
        if ($CatHash -and (($catPath -ne $CatDone) -or -not (Test-Path -LiteralPath $catPath))) {
          $CatHash = ''
          $cat = Invoke-RestMethod -Uri $CatApi -Headers $Headers -TimeoutSec 60
        }
        if ($cat.content) {
          $catAck = @{ hash = [string]$cat.hash; items = $cat.items }
          try {
            $catDir = Split-Path -Parent $catPath
            if ($catDir -and -not (Test-Path -LiteralPath $catDir)) { $null = [IO.Directory]::CreateDirectory($catDir) }
            $tmp = $catPath + '.tmp'
            [IO.File]::WriteAllBytes($tmp, [Convert]::FromBase64String([string]$cat.content))
            Move-Item -LiteralPath $tmp -Destination $catPath -Force -ErrorAction Stop
            $CatHash = [string]$cat.hash
            $CatDone = $catPath
            $catAck.status = 'written'
            Write-Host ((Get-Date -Format 'HH:mm:ss') + ' Katalog GibLab obnovlen: ' + $cat.items + ' strok') -ForegroundColor Cyan
          } catch {
            $catAck.status = 'failed'
            $catAck.error = $_.Exception.Message
          }
          $catJson = ConvertTo-Json -InputObject $catAck -Compress
          $null = Invoke-RestMethod -Uri $CatApi -Method Post -Headers $Headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($catJson)) -TimeoutSec 60
        }
      }
    } catch {
      Write-Host ((Get-Date -Format 'HH:mm:ss') + ' Katalog oshibka: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
  }
  $Loop++
  if ($wait -lt 15) { $wait = 15 }
  Start-Sleep -Seconds $wait
}
`;
  const lines = [
    "@echo off",
    "chcp 65001 >nul",
    "title Artisan - papki stankov",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText('%~f0',[Text.Encoding]::UTF8); $i=$s.LastIndexOf('#PS'+'START'); iex $s.Substring($i)"`,
    "pause",
    "exit /b",
    marker,
    ps.trim(),
    "",
  ];
  return lines.join("\r\n");
}
