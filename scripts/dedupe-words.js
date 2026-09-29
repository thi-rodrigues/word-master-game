/**
 * Remove entradas duplicadas pelo campo "en" (comparacao case-insensitive).
 * Mantem a primeira ocorrencia encontrada no arquivo e remove as demais.
 * Nada e reordenado: apenas os itens duplicados sao removidos.
 */
const fs = require("node:fs");
const path = require("node:path");

const wordsFile = path.join(__dirname, "..", "public", "words.json");
const key = (v) =>
  String(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const data = JSON.parse(fs.readFileSync(wordsFile, "utf8"));
const before = data.length;

const seen = new Map();
const removed = [];

const kept = data.filter((w) => {
  const k = key(w.en);
  if (!k) return true;
  if (!seen.has(k)) {
    seen.set(k, w.id);
    return true;
  }
  removed.push({ en: w.en, removedId: w.id, keptId: seen.get(k) });
  return false;
});

if (!removed.length) {
  console.log(`Nenhum duplicado encontrado. Total: ${before}`);
  process.exit(0);
}

fs.writeFileSync(wordsFile, JSON.stringify(kept, null, 2) + "\n", "utf8");
console.log(`Antes: ${before} | Removidos: ${removed.length} | Depois: ${kept.length}`);
for (const r of removed) {
  console.log(`  - "${r.en}" (id ${r.removedId}) -> mantido id ${r.keptId}`);
}
