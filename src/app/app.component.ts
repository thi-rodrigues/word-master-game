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
	mode: 'shared' | 'custom' = 'custom';
	words: Word[] = [];
	sharedWords: Word[] = [];
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
		this.mode = localStorage.getItem('vocab-mode-v1') === 'shared' ? 'shared' : 'custom';
		this.words = this.read<Word[]>('vocab-words-v1', []);
		this.scores = this.read<Score[]>('vocab-scores-v1', []);
		fetch('/words-base.json')
			.then(r => r.json())
			.then(x => (this.sharedWords = x))
			.catch(() => {});
	}
	get activeWords() {
		return this.mode === 'shared' ? this.sharedWords : this.words;
	}
	get categories() {
		return [...new Set(this.activeWords.map(w => w.category?.trim() || 'Sem categoria'))].sort((a, b) =>
			a.localeCompare(b),
		);
	}
	get filteredWords() {
		return this.filter ? this.words.filter(w => (w.category?.trim() || 'Sem categoria') === this.filter) : this.words;
	}
	private read<T>(key: string, fallback: T): T {
		try {
			return JSON.parse(localStorage.getItem(key) || '') as T;
		} catch {
			return fallback;
		}
	}
	private saveWords() {
		localStorage.setItem('vocab-words-v1', JSON.stringify(this.words));
	}
	register() {
		if (!this.user.trim()) return;
		this.user = this.user.trim();
		localStorage.setItem('vocab-user-v1', this.user);
		localStorage.setItem('vocab-mode-v1', this.mode);
		if (this.mode === 'shared') this.view = 'play';
	}
	logout() {
		localStorage.removeItem('vocab-user-v1');
		this.user = '';
		this.view = 'home';
	}
	addWord() {
		const en = this.en.trim(),
			pt = this.pt.trim();
		if (!en || !pt) return;
		const norm = (s: string) =>
			s
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase();
		if (this.words.some(w => norm(w.en) === norm(en) && norm(w.pt) === norm(pt))) {
			this.message = 'Esta palavra já está cadastrada.';
			return;
		}
		this.words.push({ id: crypto.randomUUID(), en, pt, category: this.category.trim() || undefined });
		this.saveWords();
		this.en = this.pt = this.category = '';
		this.message = 'Palavra adicionada com sucesso.';
	}
	remove(id: string) {
		this.words = this.words.filter(w => w.id !== id);
		this.saveWords();
	}
	toggleCategory(c: string) {
		this.selection = this.selection.includes(c) ? this.selection.filter(x => x !== c) : [...this.selection, c];
	}
	start(lang: 'pt' | 'en') {
		const source = this.selection.length
			? this.activeWords.filter(w => this.selection.includes(w.category?.trim() || 'Sem categoria'))
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
		const n = (s: string) =>
			s
				.trim()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase();
		const correct = n(this.answer) === n(this.expected);
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
		this.idx++;
		this.answer = '';
		this.result = null;
		if (this.idx >= this.queue.length) this.complete();
	}
	togglePause() {
		this.paused = !this.paused;
	}
	complete() {
		if (this.finished) return;
		this.finished = true;
		window.clearInterval(this.timer);
		const s: Score = {
			id: crypto.randomUUID(),
			user: this.user,
			lang: this.lang,
			right: this.right,
			wrong: this.wrong,
			total: this.queue.length,
			durationSeconds: this.elapsed,
			startedAt: this.startedAt,
			finishedAt: Date.now(),
			at: Date.now(),
		};
		this.scores = [s, ...this.scores];
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
	duration(s: number) {
		return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	}
	percent(s: Score) {
		return s.total ? Math.round((s.right / s.total) * 100) : 0;
	}
}
