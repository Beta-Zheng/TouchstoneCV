// Render the actual template and generated Word files, rather than testing text extraction alone.
import { createServer as createViteServer } from "vite";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";

const output = resolve(".export-qa");
await mkdir(output, { recursive: true });
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const { A4Sheet } = await vite.ssrLoadModule("/src/components/template.tsx");
const { paginateResume } = await vite.ssrLoadModule("/src/lib/pagination.ts");
const { generateDocx } = await vite.ssrLoadModule("/src/lib/export.ts");
const { buildSampleResume } = await vite.ssrLoadModule("/src/lib/samples.ts");
const assets = await readdir("dist/assets");
const css = assets.find((f) => f.endsWith(".css"));
assert(css, "Run npm run build before export QA");
const html = (body) =>
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/${css}"></head><body>${body}</body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end("<!doctype html><html><body></body></html>");
      return;
    }
    const path = resolve(
      "dist",
      decodeURIComponent((req.url ?? "/").replace(/^\/(?:TouchstoneCV\/)?/, ""))
    );
    if (
      !path.startsWith(resolve("dist") + "/") &&
      !path.startsWith(resolve("dist") + "\\")
    )
      throw new Error("Invalid path");
    res.setHeader(
      "Content-Type",
      extname(path) === ".css"
        ? "text/css"
        : extname(path) === ".woff2"
        ? "font/woff2"
        : "application/octet-stream"
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(
  process.env.QA_BROWSER ? { executablePath: process.env.QA_BROWSER } : {}
);
const failures = [];
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
page.on("pageerror", (error) => failures.push(error.message));
const report = [];

async function checkPdf(path, name, expectedPages) {
  const pdf = await getDocument({
    data: new Uint8Array(await readFile(path)),
    useSystemFonts: true,
  }).promise;
  if (expectedPages !== undefined)
    assert.equal(
      pdf.numPages,
      expectedPages,
      `${name}: unexpected blank or overflow page`
    );
  let allText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const viewport = p.getViewport({ scale: 1 });
    assert(
      Math.abs(viewport.width - 595.28) < 2 &&
        Math.abs(viewport.height - 841.89) < 2,
      `${name}: page must be A4`
    );
    const text = await p.getTextContent();
    const items = text.items.filter((x) => "str" in x && x.str.trim());
    assert(items.length > 0, `${name}: blank page ${i}`);
    for (const item of items) {
      const [x, y] = item.transform.slice(4);
      assert(
        x >= -2 &&
          x + item.width <= viewport.width + 2 &&
          y >= -2 &&
          y <= viewport.height + 2,
        `${name}: text outside page ${i}`
      );
    }
    allText += items.map((x) => x.str).join("");
  }
  assert(allText.includes("导出验证"), `${name}: Chinese glyphs or name lost`);
  assert(!allText.includes("**"), `${name}: bold markup leaked into output`);
  assert(allText.includes("20%"), `${name}: outcome number lost`);
  await pdf.destroy();
}

try {
  for (const template of [
    "modern_single_column",
    "classic_ats",
    "academic_photo",
  ]) {
    for (const locale of ["zh", "en"]) {
      const data = buildSampleResume("frontend", "experienced");
      data.basic_info.name = "**导出验证**";
      data.avatar_url = "";
      data.school_badge_url = "";
      const work = data.sections.find((s) => s.type === "work_experience");
      work.blocks[0].bullets.push("参与页面优化，耗时降低约 20%");
      // Enough real blocks to exercise page boundaries and repeated headings.
      work.blocks = Array.from({ length: 6 }, (_, i) => ({
        ...structuredClone(work.blocks[i % work.blocks.length]),
        block_id: `qa-work-${i}`,
        order: i,
      }));
      const resume = {
        id: "qa",
        title: "导出验证",
        template_id: template,
        locale,
        theme: { primary_color: "#4f46e5", font_size: 14 },
        data,
      };
      const base = `${template}-${locale}`;
      await page.goto(origin);
      await page.setContent(
        html(renderToStaticMarkup(React.createElement(A4Sheet, { resume })))
      );
      await page.evaluate(() => document.fonts.ready);
      const sizes = await page.evaluate(() => {
        const heights = {};
        const sections = {};
        document.querySelectorAll("[data-resume-entry]").forEach((el) => {
          heights[el.dataset.resumeEntry] =
            el.getBoundingClientRect().height +
            parseFloat(getComputedStyle(el).marginBottom || "0");
        });
        document.querySelectorAll("[data-resume-section]").forEach((el) => {
          const h = el.querySelector("h2");
          sections[el.dataset.resumeSection] =
            h.getBoundingClientRect().height +
            parseFloat(getComputedStyle(h).marginBottom) +
            parseFloat(getComputedStyle(el).marginBottom);
        });
        const header = document.querySelector(".resume-sheet header");
        const padded = document.querySelector(".resume-sheet-wrap > div");
        return {
          heights,
          sections,
          header: header
            ? header.getBoundingClientRect().height +
              parseFloat(getComputedStyle(header).marginBottom)
            : 0,
          capacity:
            1119 -
            parseFloat(getComputedStyle(padded).paddingTop) -
            parseFloat(getComputedStyle(padded).paddingBottom),
        };
      });
      const pages = paginateResume(
        resume,
        sizes.heights,
        sizes.header,
        sizes.sections,
        sizes.capacity
      );
      assert(
        pages.length > 1,
        `${base}: multipage fixture must exercise pagination`
      );
      assert(
        pages.every((p) => !p.oversized),
        `${base}: fixture entry exceeds a page`
      );
      const content = pages
        .map(
          (p) =>
            `<div class="resume-print-page">${renderToStaticMarkup(
              React.createElement(A4Sheet, { resume: p.resume, forPrint: true })
            )}</div>`
        )
        .join("");
      await page.setContent(html(`<div class="print-only">${content}</div>`));
      await page.evaluate(() => document.fonts.ready);
      const pdfPath = resolve(output, `${base}.pdf`);
      await page.pdf({
        path: pdfPath,
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
      });
      await checkPdf(pdfPath, base, pages.length);
      const docxPath = resolve(output, `${base}.docx`);
      await writeFile(docxPath, new Uint8Array(await generateDocx(resume)));
      const wordOutput = resolve(output, "word");
      await mkdir(wordOutput, { recursive: true });
      const word = spawnSync(
        process.env.SOFFICE ?? "soffice",
        [
          "--headless",
          `-env:UserInstallation=${
            pathToFileURL(resolve(output, "lo-profile")).href
          }`,
          "--convert-to",
          "pdf",
          "--outdir",
          wordOutput,
          docxPath,
        ],
        { encoding: "utf8" }
      );
      const wordRendered = !word.error && word.status === 0;
      if (process.env.REQUIRE_WORD_QA === "1")
        assert(wordRendered, "LibreOffice is required for Word layout QA");
      if (wordRendered)
        await checkPdf(resolve(wordOutput, `${base}.pdf`), `${base}-word`);
      const poppler = process.env.PDFTOPPM ?? "pdftoppm";
      const raster = spawnSync(
        poppler,
        ["-r", "96", "-png", pdfPath, resolve(output, base)],
        { encoding: "utf8" }
      );
      let wordPageImages = false;
      if (wordRendered) {
        const wordRaster = spawnSync(
          poppler,
          [
            "-r",
            "96",
            "-png",
            resolve(wordOutput, `${base}.pdf`),
            resolve(wordOutput, base),
          ],
          { encoding: "utf8" }
        );
        wordPageImages = !wordRaster.error && wordRaster.status === 0;
        if (process.env.REQUIRE_WORD_QA === "1")
          assert(
            wordPageImages,
            "Word pages must render to images for layout review"
          );
      }
      report.push({
        template,
        locale,
        pdfPages: pages.length,
        wordRendered,
        wordPageImages,
        pageImages: !raster.error && raster.status === 0,
      });
      console.log(
        `${base}: PDF ${pages.length} pages, bounds/text OK; Word ${
          wordRendered ? "rendered" : "renderer unavailable"
        }`
      );
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2)
  );
} finally {
  await browser.close();
  server.close();
  await vite.close();
}
