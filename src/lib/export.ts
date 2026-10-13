import type { Resume } from "../types";
import { localizedResume, blockHasContent } from "./workflow";
import { stripHtml } from "./utils";

export function plainText(value: string): string {
  return stripHtml(
    value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n")
  )
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\*\*/g, "");
}
export interface DocumentParagraph {
  text: string;
  style: "name" | "heading" | "entry" | "body";
}
export function resumeParagraphs(input: Resume): DocumentParagraph[] {
  const resume = localizedResume(input);
  const info = resume.data.basic_info;
  const result: DocumentParagraph[] = [];
  const push = (
    text: string,
    style: DocumentParagraph["style"] = "body",
    rich = false
  ) => {
    if (text.trim())
      result.push({
        text: rich ? plainText(text) : text.replace(/\*\*/g, ""),
        style,
      });
  };
  if (
    resume.data.sections.find((s) => s.type === "basic_info")?.visible !== false
  ) {
    push(info.name, "name");
    push(info.title);
    push(
      [
        info.email,
        info.phone,
        info.location,
        info.website,
        ...(info.custom_fields ?? [])
          .filter((f) => f.label.trim() && f.value.trim())
          .map((f) => `${f.label}: ${f.value}`),
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }
  for (const s of [...resume.data.sections]
    .filter((s) => s.visible && s.type !== "basic_info")
    .sort((a, b) => a.order - b.order)) {
    const blocks = [...s.blocks]
      .filter((b) => b.visible && blockHasContent(b))
      .sort((a, b) => a.order - b.order);
    if (!blocks.length) continue;
    push(s.title, "heading");
    for (const b of blocks) {
      push(
        [b.title, b.subtitle, ...(b.subtitles ?? [])]
          .filter(Boolean)
          .join(" · "),
        "entry"
      );
      push(
        [[b.start_date, b.end_date].filter(Boolean).join(" – "), b.location]
          .filter(Boolean)
          .join(" | ")
      );
      push(b.description, "body", true);
      b.bullets.forEach((bullet, i) =>
        push(
          `${b.bullet_marks?.[i] === false ? "" : "• "}${bullet}`,
          "body",
          true
        )
      );
      push(b.skills.join(" · "));
      push(b.links.join(" | "));
    }
  }
  return result;
}
export const resumeText = (resume: Resume) =>
  resumeParagraphs(resume)
    .map((p) => p.text)
    .join("\n");
const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Produce an editable, single-column Word document entirely in the browser. */
export async function generateDocx(resume: Resume): Promise<ArrayBuffer> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const paragraphs = resumeParagraphs(resume)
    .map((p) => {
      const size =
        p.style === "name"
          ? 36
          : p.style === "heading"
          ? 25
          : Math.round(resume.theme.font_size * 1.5);
      const strong = p.style !== "body";
      const keep =
        p.style === "heading" || p.style === "entry" ? "<w:keepNext/>" : "";
      const runs = p.text
        .split("\n")
        .map(
          (line, i) =>
            `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${size}"/>${
              strong ? "<w:b/>" : ""
            }</w:rPr>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${xml(
              line
            )}</w:t></w:r>`
        )
        .join("");
      return `<w:p><w:pPr>${keep}<w:spacing w:after="${
        p.style === "heading" ? 120 : 80
      }" w:line="260" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
    })
    .join("");
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`
  );
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
