
const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const { promises: fs } = require("node:fs");

const app = express();

const port = process.env.PORT || 3000;

const wordsFile = path.join(__dirname, "public", "words.json");

function normalise(value) {
  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

app.use(express.json());

app.post("/api/words", async (req, res) => {
  try {
    const payload = req.body;

    const submitted = Array.isArray(payload.words) ? payload.words : [];

    if (!submitted.length || submitted.some((word) => !word.en?.trim() || !word.pt?.trim())) {
      return res.status(400).json({
        message: "Each word must have en and pt values.",
      });
    }

    const saved = JSON.parse(await fs.readFile(wordsFile, "utf8"));

    const keys = new Set(saved.map((word) => `${normalise(word.en)}|${normalise(word.pt)}`));

    const additions = submitted
      .filter((word) => !keys.has(`${normalise(word.en)}|${normalise(word.pt)}`))
      .map((word) => ({
        id: word.id || crypto.randomUUID(),
        en: word.en.trim(),
        pt: word.pt.trim(),
        category: word.category?.trim(),
      }));

    await fs.writeFile(wordsFile, JSON.stringify([...saved, ...additions], null, 2));

    res.status(201).json({
      words: additions,
    });
  } catch (e) {
    res.status(400).json({
      message: "Invalid request.",
    });
  }
});

app.delete("/api/words/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const saved = JSON.parse(await fs.readFile(wordsFile, "utf8"));

    const words = saved.filter((w) => w.id !== id);

    if (saved.length === words.length) {
      return res.status(404).json({
        message: "Word not found.",
      });
    }

    await fs.writeFile(wordsFile, JSON.stringify(words, null, 2));

    res.json({
      id,
    });
  } catch {
    res.status(400).json({
      message: "Unable to remove word.",
    });
  }
});

app.use(express.static(path.join(__dirname, "dist/word-master-game/browser")));

app.get("/{*any}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/word-master-game/browser/index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
