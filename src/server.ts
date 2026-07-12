import "./lib/error-capture";

import { promises as fs } from "node:fs";
import path from "node:path";

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
