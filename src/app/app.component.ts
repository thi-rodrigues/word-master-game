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
  sharedWords: Word[] = [];
  wordsLoaded = false;
  wordsLoadError = false;
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

  private read<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || '') as T;
    } catch {
      return fallback;
    }
  }

  register() {
    if (!this.user.trim()) return;
    this.user = this.user.trim();
    localStorage.setItem('vocab-user-v1', this.user);
    this.view = 'play';
  }

  logout() {
    localStorage.removeItem('vocab-user-v1');
    this.user = '';
    this.view = 'home';
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
