import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const productDir = path.join(root, "ai-sales-kit-product");
const buildDir = path.join(root, "tmp", "ai-sales-kit-xlsx");

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const inlineStr = (value) =>
  `<is><t xml:space="preserve">${escapeXml(value)}</t></is>`;

const cell = (ref, value, style = 0) => {
  if (value?.formula) {
    return `<c r="${ref}" s="${style}"><f>${escapeXml(value.formula)}</f></c>`;
  }
  if (typeof value === "number") {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr">${inlineStr(value ?? "")}</c>`;
};

const row = (index, cells) =>
  `<row r="${index}">${cells.map(([col, value, style]) => cell(`${col}${index}`, value, style)).join("")}</row>`;

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(path.join(buildDir, "_rels"), { recursive: true });
fs.mkdirSync(path.join(buildDir, "docProps"), { recursive: true });
fs.mkdirSync(path.join(buildDir, "xl", "_rels"), { recursive: true });
fs.mkdirSync(path.join(buildDir, "xl", "worksheets"), { recursive: true });

fs.writeFileSync(
  path.join(buildDir, "[Content_Types].xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
);

fs.writeFileSync(
  path.join(buildDir, "_rels", ".rels"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
);

fs.writeFileSync(
  path.join(buildDir, "docProps", "core.xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>AI Sales Kit Profit Calculator</dc:title>
  <dc:creator>AI Sales Kit</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-28T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-28T00:00:00Z</dcterms:modified>
</cp:coreProperties>`
);

fs.writeFileSync(
  path.join(buildDir, "docProps", "app.xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>AI Sales Kit</Application>
</Properties>`
);

fs.writeFileSync(
  path.join(buildDir, "xl", "workbook.xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Profit Calculator" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
);

fs.writeFileSync(
  path.join(buildDir, "xl", "_rels", "workbook.xml.rels"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
);

fs.writeFileSync(
  path.join(buildDir, "xl", "styles.xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="12"/><name val="Arial"/></font>
    <font><b/><sz val="22"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="12"/><color rgb="FF111827"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><color rgb="FF7C3AED"/><name val="Arial"/></font>
    <font><b/><sz val="13"/><color rgb="FF16A34A"/><name val="Arial"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4C1D95"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF7C3AED"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5F3FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFDDD6FE"/></left><right style="thin"><color rgb="FFDDD6FE"/></right><top style="thin"><color rgb="FFDDD6FE"/></top><bottom style="thin"><color rgb="FFDDD6FE"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
</styleSheet>`
);

const rows = [
  row(1, [["A", "ตารางคำนวณกำไรสำหรับแม่ค้าออนไลน์", 1], ["B", "", 1], ["C", "", 1]]),
  row(2, [["A", "กรอกตัวเลขต่อ 1 ออเดอร์ ช่องสีอ่อน แล้วดูผลลัพธ์ด้านล่าง", 8], ["B", "", 8], ["C", "", 8]]),
  row(4, [["A", "รายการ", 2], ["B", "จำนวนเงิน", 2], ["C", "หมายเหตุ", 2]]),
  row(5, [["A", "ราคาขาย", 3], ["B", 299, 5], ["C", "ยอดที่ลูกค้าจ่ายต่อออเดอร์", 4]]),
  row(6, [["A", "ต้นทุนสินค้า", 3], ["B", 110, 5], ["C", "รวมต้นทุนสินค้าทุกชิ้นในออเดอร์", 4]]),
  row(7, [["A", "ค่าแพ็ก / กล่อง", 3], ["B", 10, 5], ["C", "กล่อง ซอง กันกระแทก สติกเกอร์", 4]]),
  row(8, [["A", "ค่าส่งที่ร้านออกเอง", 3], ["B", 35, 5], ["C", "ถ้าลูกค้าจ่ายค่าส่งเอง ใส่ 0", 4]]),
  row(9, [["A", "ค่าธรรมเนียมแพลตฟอร์ม", 3], ["B", 15, 5], ["C", "Shopee, TikTok, payment fee", 4]]),
  row(10, [["A", "ค่าแอดต่อออเดอร์", 3], ["B", 60, 5], ["C", "งบแอดที่ใช้เพื่อได้ 1 ออเดอร์", 4]]),
  row(12, [["A", "ผลลัพธ์", 6], ["B", "", 6], ["C", "", 6]]),
  row(13, [["A", "ต้นทุนรวม", 3], ["B", { formula: "SUM(B6:B10)" }, 7], ["C", "ต้นทุนรวมทุกอย่างต่อออเดอร์", 4]]),
  row(14, [["A", "กำไรต่อออเดอร์", 3], ["B", { formula: "B5-B13" }, 7], ["C", "ถ้าติดลบ แปลว่าขายแล้วยังขาดทุน", 4]]),
  row(15, [["A", "กำไรขั้นต้นก่อนแอด", 3], ["B", { formula: "B5-SUM(B6:B9)" }, 7], ["C", "กำไรที่ยังไม่หักค่าแอด", 4]]),
  row(16, [["A", "ค่าแอดสูงสุดที่ยังไม่ขาดทุน", 3], ["B", { formula: "B15" }, 7], ["C", "ถ้า CPA เกินตัวเลขนี้ จะเริ่มขาดทุน", 4]]),
  row(18, [["A", "คาดการณ์ยอดขาย", 6], ["B", "", 6], ["C", "", 6]]),
  row(19, [["A", "กำไรต่อ 10 ออเดอร์", 3], ["B", { formula: "B14*10" }, 7], ["C", "", 4]]),
  row(20, [["A", "กำไรต่อ 50 ออเดอร์", 3], ["B", { formula: "B14*50" }, 7], ["C", "", 4]]),
  row(21, [["A", "กำไรต่อ 100 ออเดอร์", 3], ["B", { formula: "B14*100" }, 7], ["C", "", 4]]),
  row(23, [["A", "คำแนะนำ", 6], ["B", "", 6], ["C", "", 6]]),
  row(24, [["A", "ถ้ากำไรต่อออเดอร์ต่ำเกินไป ให้ลองทำแพ็กคู่ เพิ่ม AOV ลดของแถมที่ไม่จำเป็น หรือปรับกลุ่มเป้าหมายแอดก่อนเพิ่มงบ", 8], ["B", "", 8], ["C", "", 8]]),
];

fs.writeFileSync(
  path.join(buildDir, "xl", "worksheets", "sheet1.xml"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="52" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="5">
    <mergeCell ref="A1:C1"/>
    <mergeCell ref="A2:C2"/>
    <mergeCell ref="A12:C12"/>
    <mergeCell ref="A18:C18"/>
    <mergeCell ref="A23:C23"/>
  </mergeCells>
</worksheet>`
);

const xlsxPath = path.join(productDir, "Profit-Calculator-Formula.xlsx");
fs.rmSync(xlsxPath, { force: true });
execFileSync("zip", ["-qr", xlsxPath, "."], { cwd: buildDir });

const docs = [
  ["prompt-pack.md", "Prompt-Pack", "Prompt Pack 50 แบบ"],
  ["content-calendar-30-days.md", "Content-Calendar-30-Days", "Content Calendar 30 วัน"],
  ["faq-template.md", "FAQ-Template", "FAQ Template"],
  ["bonus-line-oa-reply-script.md", "LINE-OA-Reply-Script", "LINE OA Reply Script"],
  ["bonus-ad-testing-plan.md", "Ad-Testing-Plan", "แผน Test แอด 7 วัน"],
  ["bonus-launch-checklist.md", "Launch-Checklist", "Launch Checklist"],
];

const mdToHtml = (markdown, title) => {
  const body = markdown
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeXml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeXml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeXml(line.slice(4))}</h3>`;
      if (line.startsWith("> ")) return `<div class="prompt">${escapeXml(line.slice(2))}</div>`;
      if (line.startsWith("- ")) return `<p class="bullet">• ${escapeXml(line.slice(2))}</p>`;
      if (/^\d+\.\s/.test(line)) return `<p class="bullet">${escapeXml(line)}</p>`;
      if (line.trim() === "---") return `<hr>`;
      if (line.trim() === "") return "";
      return `<p>${escapeXml(line)}</p>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { color: #111827; font-family: "Noto Sans Thai", "Sarabun", "Tahoma", sans-serif; font-size: 18px; line-height: 1.65; }
    h1 { margin: 0 0 18px; color: #4c1d95; font-size: 36px; line-height: 1.2; }
    h2 { margin: 26px 0 10px; color: #7c3aed; font-size: 26px; }
    h3 { margin: 20px 0 8px; color: #111827; font-size: 21px; }
    p { margin: 0 0 9px; }
    hr { margin: 22px 0; border: 0; border-top: 1px solid #ddd6fe; }
    .bullet { margin-left: 14px; }
    .prompt { margin: 10px 0 14px; border-left: 6px solid #f97316; border-radius: 12px; background: #fff7ed; padding: 12px 14px; }
  </style>
</head>
<body>${body}</body>
</html>`;
};

for (const [source, baseName, title] of docs) {
  const markdown = fs.readFileSync(path.join(productDir, source), "utf8");
  fs.writeFileSync(path.join(productDir, `${baseName}.html`), mdToHtml(markdown, title));
}

console.log(
  JSON.stringify(
    {
      xlsx: path.relative(root, xlsxPath),
      htmlDocs: docs.length,
    },
    null,
    2
  )
);
