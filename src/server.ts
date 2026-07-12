import "./lib/error-capture";

import { promises as fs } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function normalizeWordValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function persistWordToSharedBase(en: string, pt: string) {
  const wordsFilePath = path.resolve(process.cwd(), "public", "words-base.json");
  const raw = await fs.readFile(wordsFilePath, "utf-8");
  const words = JSON.parse(raw) as Array<{ id: string; en: string; pt: string }>;

  const normalizedEn = normalizeWordValue(en);
  const normalizedPt = normalizeWordValue(pt);
  const alreadyExists = words.some(
    (word) =>
      normalizeWordValue(word.en) === normalizedEn && normalizeWordValue(word.pt) === normalizedPt,
  );

  if (alreadyExists) {
    return { ok: false, reason: "duplicate", words };
  }

  const nextWords = [
    ...words,
    {
      id: `shared-${Date.now()}`,
      en: en.trim(),
      pt: pt.trim(),
    },
  ];

  await fs.writeFile(wordsFilePath, `${JSON.stringify(nextWords, null, 2)}\n`, "utf-8");
  return { ok: true, words: nextWords };
}

async function removeWordFromSharedBase(id: string) {
  const wordsFilePath = path.resolve(process.cwd(), "public", "words-base.json");
  const raw = await fs.readFile(wordsFilePath, "utf-8");
  const words = JSON.parse(raw) as Array<{ id: string; en: string; pt: string; category?: string }>;
  const nextWords = words.filter((word) => word.id !== id);

  await fs.writeFile(wordsFilePath, `${JSON.stringify(nextWords, null, 2)}\n`, "utf-8");
  return { ok: true, words: nextWords };
}

async function updateWordInSharedBase(id: string, category?: string) {
  const wordsFilePath = path.resolve(process.cwd(), "public", "words-base.json");
  const raw = await fs.readFile(wordsFilePath, "utf-8");
  const words = JSON.parse(raw) as Array<{ id: string; en: string; pt: string; category?: string }>;
  
  const wordIndex = words.findIndex((word) => word.id === id);
  
  if (wordIndex === -1) {
    return { ok: false, reason: "not_found", words };
  }

  const nextWords = [...words];
  nextWords[wordIndex] = {
    ...nextWords[wordIndex],
    category: category?.trim() || undefined,
  };

  await fs.writeFile(wordsFilePath, `${JSON.stringify(nextWords, null, 2)}\n`, "utf-8");
  return { ok: true, words: nextWords };
}

async function importWordsFromExcel(fileBuffer: ArrayBuffer) {
  const wordsFilePath = path.resolve(process.cwd(), "public", "words-base.json");
  const raw = await fs.readFile(wordsFilePath, "utf-8");
  const existingWords = JSON.parse(raw) as Array<{ id: string; en: string; pt: string; category?: string }>;

  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];

  const newWords: Array<{ id: string; en: string; pt: string; category?: string }> = [];
  let importedCount = 0;

  for (const row of jsonData) {
    // Support multiple column name variations (with and without accents, uppercase/lowercase)
    const category = (
      row.Categoria || 
      row.CATEGORIA || 
      row.category || 
      row.Category
    )?.trim();

    // Get potential values for English and Portuguese columns
    const potentialEn = (
      row.Inglês || 
      row.INGLÊS || 
      row.INGLES || 
      row.en || 
      row.En ||
      row.English
    )?.trim();

    const potentialPt = (
      row.Português || 
      row.PORTUGUÊS || 
      row.PORTUGUES || 
      row.pt || 
      row.Pt ||
      row.Portugues
    )?.trim();

    // If both values are present, use them as-is
    let en = potentialEn;
    let pt = potentialPt;

    // If one is missing, try to detect based on the other value
    if (!en && pt) {
      en = pt;
      pt = "";
    } else if (en && !pt) {
      pt = en;
      en = "";
    }

    if (!en || !pt) continue;

    const normalizedEn = normalizeWordValue(en);
    const normalizedPt = normalizeWordValue(pt);

    const alreadyExists = existingWords.some(
      (word) =>
        normalizeWordValue(word.en) === normalizedEn && normalizeWordValue(word.pt) === normalizedPt,
    );

    if (alreadyExists) continue;

    newWords.push({
      id: `shared-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      en,
      pt,
      category: category || undefined,
    });

    importedCount++;
  }

  if (newWords.length === 0) {
    return { ok: false, reason: "no_new_words", imported: 0, words: existingWords };
  }

  const nextWords = [...existingWords, ...newWords];
  await fs.writeFile(wordsFilePath, `${JSON.stringify(nextWords, null, 2)}\n`, "utf-8");

  return { ok: true, imported: importedCount, words: nextWords };
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/words" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          id?: string;
          en?: string;
          pt?: string;
        } | null;

        if (!payload?.en?.trim() || !payload?.pt?.trim()) {
          return Response.json(
            { ok: false, message: "Informe inglês e português válidos." },
            { status: 400 },
          );
        }

        const result = await persistWordToSharedBase(payload.en, payload.pt);

        if (!result.ok) {
          return Response.json(
            { ok: false, message: "Essa palavra já está cadastrada." },
            { status: 409 },
          );
        }

        return Response.json({ ok: true, words: result.words }, { status: 200 });
      }

      if (url.pathname === "/api/words" && request.method === "DELETE") {
        const payload = (await request.json().catch(() => null)) as { id?: string } | null;

        if (!payload?.id?.trim()) {
          return Response.json(
            { ok: false, message: "Informe o identificador da palavra." },
            { status: 400 },
          );
        }

        const result = await removeWordFromSharedBase(payload.id);
        return Response.json({ ok: true, words: result.words }, { status: 200 });
      }

      if (url.pathname === "/api/words" && request.method === "PUT") {
        const payload = (await request.json().catch(() => null)) as {
          id?: string;
          category?: string;
        } | null;

        if (!payload?.id?.trim()) {
          return Response.json(
            { ok: false, message: "Informe o identificador da palavra." },
            { status: 400 },
          );
        }

        const result = await updateWordInSharedBase(payload.id, payload.category);

        if (!result.ok) {
          return Response.json(
            { ok: false, message: "Palavra não encontrada." },
            { status: 404 },
          );
        }

        return Response.json({ ok: true, words: result.words }, { status: 200 });
      }

      if (url.pathname === "/api/words/import" && request.method === "POST") {
        try {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return Response.json(
              { ok: false, message: "Nenhum arquivo enviado." },
              { status: 400 },
            );
          }

          const arrayBuffer = await file.arrayBuffer();
          const result = await importWordsFromExcel(arrayBuffer);

          if (!result.ok) {
            if (result.reason === "no_new_words") {
              return Response.json(
                { ok: false, message: "Nenhuma palavra nova foi importada (todas já existem)." },
                { status: 409 },
              );
            }
            return Response.json(
              { ok: false, message: "Erro ao importar palavras." },
              { status: 500 },
            );
          }

          return Response.json(
            { ok: true, imported: result.imported, words: result.words },
            { status: 200 },
          );
        } catch (error) {
          console.error("Import error:", error);
          return Response.json(
            { ok: false, message: "Erro ao processar arquivo Excel." },
            { status: 500 },
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
