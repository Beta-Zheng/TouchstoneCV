// Native IndexedDB regression in an isolated headless browser context (no user profile).
import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
await server.listen();
const origin = server.resolvedUrls.local[0];
const browser = await chromium.launch(
  process.env.QA_BROWSER ? { executablePath: process.env.QA_BROWSER } : {}
);
try {
  const page = await browser.newPage();
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const {
      indexedDocumentBackend,
      packDocument,
      unpackDocument,
      createDocumentStorage,
    } = await import("/src/lib/document-storage.ts");
    const a = indexedDocumentBackend(),
      b = indexedDocumentBackend();
    await Promise.all([a.read("test"), b.read("test")]);
    const initial = {
      state: {
        text: "初始内容",
        resumes: [
          {
            data: {
              sections: [],
              avatar_url: "data:image/png;base64,TEST",
              metadata: { source_text: "原始文字" },
            },
          },
        ],
      },
    };
    await a.write("test", await packDocument(initial));
    let conflict = false;
    try {
      await b.write("test", await packDocument({ state: { text: "旧窗口" } }));
    } catch {
      conflict = true;
    }
    const after = unpackDocument(await b.read("test"));
    await b.write(
      "test",
      await packDocument({ state: { text: "重新读取后修改" } })
    );
    const next = unpackDocument(await a.read("test"));
    await a.remove("test");
    localStorage.setItem("legacy", JSON.stringify(initial));
    const states = [];
    const storage = createDocumentStorage(
      indexedDocumentBackend(),
      () => localStorage,
      (s) => states.push(s),
      (s) => s
    );
    const migrated = await storage.storage.getItem("legacy");
    const removedLegacy = localStorage.getItem("legacy") === null;
    const roundtrip = unpackDocument(
      await indexedDocumentBackend().read("legacy")
    );
    const reader = indexedDocumentBackend();
    await reader.read("legacy");
    const cleared = { state: { text: "cleared" } };
    await reader.write("legacy", await packDocument(cleared));
    const packedCleared = await reader.read("legacy");
    return {
      conflict,
      after,
      next,
      migrated,
      removedLegacy,
      roundtrip,
      recordsAfterClear: packedCleared.records.size,
      assetsAfterClear: packedCleared.assets.size,
    };
  });
  assert(result.conflict, "stale browser window must not overwrite data");
  assert.equal(result.after.state.text, "初始内容");
  assert.equal(result.next.state.text, "重新读取后修改");
  assert.deepEqual(result.migrated, result.roundtrip);
  assert(result.removedLegacy);
  assert.equal(result.assetsAfterClear, 0);
  assert.equal(result.recordsAfterClear, 0);
  console.log(
    "Native IndexedDB: transactions, stale writer rejection, migration, reload and orphan cleanup passed"
  );
} finally {
  await browser.close();
  await server.close();
}
