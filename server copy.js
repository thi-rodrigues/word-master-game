const http = require('node:http');
const { promises: fs } = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);
const wordsFile = path.join(__dirname, 'public', 'words.json');

const express = require("express");
// const path = require("path");

const app = express();

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalise(value) {
  return String(value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

http.createServer(async (request, response) => {
	if (request.method === 'DELETE' && request.url?.startsWith('/api/words/')) {
		try {
			const id = decodeURIComponent(request.url.slice('/api/words/'.length));
			const saved = JSON.parse(await fs.readFile(wordsFile, 'utf8'));
			const words = saved.filter(word => word.id !== id);
			if (words.length === saved.length) {
				send(response, 404, { message: 'Word not found.' });
				return;
			}
			await fs.writeFile(wordsFile, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
			send(response, 200, { id });
		} catch {
			send(response, 400, { message: 'Unable to remove word.' });
		}
		return;
	}

	if (request.method !== 'POST' || request.url !== '/api/words') {
    send(response, 404, { message: 'Not found.' });
    return;
  }

  if (request.method === 'GET' && request.url === '/') {
    const index = await fs.readFile(
        path.join(__dirname, 'dist/word-master-game/browser/index.html')
    );

    response.writeHead(200, {
        'Content-Type': 'text/html'
    });

    response.end(index);
    return;
}

  try {
    const payload = await readBody(request);
    const submitted = Array.isArray(payload.words) ? payload.words : [];
    if (!submitted.length || submitted.some(word => !word?.en?.trim() || !word?.pt?.trim())) {
      send(response, 400, { message: 'Each word must have en and pt values.' });
      return;
    }

    const saved = JSON.parse(await fs.readFile(wordsFile, 'utf8'));
    const keys = new Set(saved.map(word => `${normalise(word.en)}|${normalise(word.pt)}`));
    const additions = submitted
      .filter(word => !keys.has(`${normalise(word.en)}|${normalise(word.pt)}`))
      .map(word => ({
        id: word.id || `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        en: word.en.trim(), pt: word.pt.trim(), category: word.category?.trim() || undefined,
      }));

    await fs.writeFile(wordsFile, `${JSON.stringify([...saved, ...additions], null, 2)}\n`, 'utf8');
    send(response, 201, { words: additions });
  } catch {
    send(response, 400, { message: 'Invalid request.' });
  }
}).listen(port, () => console.log(`Word API running at http://localhost:${port}`));
