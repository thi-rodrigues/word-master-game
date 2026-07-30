import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Word = { id: string; en: string; pt: string; category?: string };
type Score = {
  id: string;
  user: string;
  lang: 'pt' | 'en';
  right: number;
  wrong: number;
  total: number;
  durationSeconds: number;
  startedAt: number;
  finishedAt: number;
  at: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  view: 'home' | 'play' | 'quiz' | 'ranking' = 'home';
  user = '';
  nameInput = '';
  sharedWords: Word[] = [];
  wordsLoaded = false;
  wordsLoadError = false;
  en = '';
  pt = '';
  category = '';
  filter = '';
  message = '';
  selection: string[] = [];
  lang: 'pt' | 'en' = 'pt';
  queue: Word[] = [];
  idx = 0;
  answer = '';
  result: { correct: boolean; expected: string } | null = null;
  right = 0;
  wrong = 0;
  elapsed = 0;
  paused = false;
  finished = false;
  timer?: number;
  startedAt = 0;
  scores: Score[] = [];

  ngOnInit() {
    this.user = localStorage.getItem('vocab-user-v1') || '';
    this.scores = this.read<Score[]>('vocab-scores-v1', []);
    fetch('/words-base.json')
      .then(response => {
        if (!response.ok) throw new Error('Unable to load vocabulary.');
        return response.json() as Promise<Word[]>;
      })
      .then(words => {
        this.sharedWords = words;
        this.wordsLoaded = true;
      })
      .catch(() => (this.wordsLoadError = true));
  }

  get activeWords() {
    return this.sharedWords;
  }

  get categories() {
    return [...new Set(this.activeWords.map(word => word.category?.trim() || 'Sem categoria'))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  get filteredWords() {
    return this.filter
      ? this.activeWords.filter(word => (word.category?.trim() || 'Sem categoria') === this.filter)
      : this.activeWords;
  }

  private read<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || '') as T;
    } catch {
      return fallback;
    }
  }

  register() {
    if (!this.nameInput.trim()) return;
    this.user = this.nameInput.trim();
    localStorage.setItem('vocab-user-v1', this.user);
    this.view = 'play';
  }

  logout() {
    localStorage.removeItem('vocab-user-v1');
    this.user = '';
    this.nameInput = '';
    this.view = 'home';
  }

  addWord() {
    const en = this.en.trim();
    const pt = this.pt.trim();
    if (!en || !pt) return;
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (this.sharedWords.some(word => normalize(word.en) === normalize(en) && normalize(word.pt) === normalize(pt))) {
      this.message = 'Esta palavra ja esta cadastrada.';
      return;
    }
    this.sharedWords = [...this.sharedWords, { id: crypto.randomUUID(), en, pt, category: this.category.trim() || undefined }];
    this.en = '';
    this.pt = '';
    this.category = '';
    this.message = 'Palavra adicionada para esta sessao.';
  }

  removeWord(id: string) {
    this.sharedWords = this.sharedWords.filter(word => word.id !== id);
  }

  importWords(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text()
      .then(text => JSON.parse(text) as Word[])
      .then(words => {
        if (!Array.isArray(words) || words.some(word => !word.en || !word.pt)) throw new Error('Invalid vocabulary file.');
        const existing = new Set(this.sharedWords.map(word => `${word.en.toLowerCase()}|${word.pt.toLowerCase()}`));
        const additions = words.filter(word => !existing.has(`${word.en.toLowerCase()}|${word.pt.toLowerCase()}`));
        this.sharedWords = [...this.sharedWords, ...additions.map(word => ({ ...word, id: word.id || crypto.randomUUID() }))];
        this.message = `${additions.length} palavra(s) importada(s) para esta sessao.`;
      })
      .catch(() => (this.message = 'Arquivo invalido. Use um JSON com os campos en e pt.'));
    input.value = '';
  }

  toggleCategory(category: string) {
    this.selection = this.selection.includes(category)
      ? this.selection.filter(item => item !== category)
      : [...this.selection, category];
  }

  start(lang: 'pt' | 'en') {
    const source = this.selection.length
      ? this.activeWords.filter(word => this.selection.includes(word.category?.trim() || 'Sem categoria'))
      : this.activeWords;
    if (!source.length) return;
    this.lang = lang;
    this.queue = [...source].sort(() => Math.random() - 0.5);
    this.idx = this.right = this.wrong = this.elapsed = 0;
    this.answer = '';
    this.result = null;
    this.paused = this.finished = false;
    this.startedAt = Date.now();
    this.view = 'quiz';
    this.startTimer();
  }

  get current() {
    return this.queue[this.idx];
  }

  get prompt() {
    return this.current ? (this.lang === 'pt' ? this.current.en : this.current.pt) : '';
  }

  get expected() {
    return this.current ? (this.lang === 'pt' ? this.current.pt : this.current.en) : '';
  }

  check() {
    if (this.result) {
      this.next();
      return;
    }
    if (!this.answer.trim() || !this.current || this.paused) return;
    const normalize = (value: string) =>
      value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const correct = normalize(this.answer) === normalize(this.expected);
    this.result = { correct, expected: this.expected };
    correct ? this.right++ : this.wrong++;
  }

  next() {
    this.idx++;
    this.answer = '';
    this.result = null;
    if (this.idx >= this.queue.length) this.complete();
  }

  skip() {
    this.next();
  }

  togglePause() {
    this.paused = !this.paused;
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    window.clearInterval(this.timer);
    const score: Score = {
      id: crypto.randomUUID(), user: this.user, lang: this.lang, right: this.right, wrong: this.wrong,
      total: this.queue.length, durationSeconds: this.elapsed, startedAt: this.startedAt,
      finishedAt: Date.now(), at: Date.now(),
    };
    this.scores = [score, ...this.scores];
    localStorage.setItem('vocab-scores-v1', JSON.stringify(this.scores));
  }

  restart() {
    this.start(this.lang);
  }

  startTimer() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!this.paused && !this.finished) this.elapsed++;
    }, 1000);
  }

  duration(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  percent(score: Score) {
    return score.total ? Math.round((score.right / score.total) * 100) : 0;
  }
}
