import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Word = { id?: string; en: string; pt: string; category?: string, pronunciation: string; sentence?: string; level?: string };
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
  view: 'home' | 'play' | 'quiz' | 'ranking' = 'play';
  userLogged = localStorage.getItem('userLogged');
  nameInput = '';
  sharedWords: Word[] = [];
  wordsLoaded = false;
  wordsLoadError = false;
  en = '';
  pt = '';
  category = '';
  pronunciation = '';
  sentence = '';
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
  resumed = false;
  audioUrl = '';
  audioLoading = false;
  audioError = '';
  private audio?: HTMLAudioElement;
  private audioCache = new Map<string, string>();
  private audioFailures = new Map<string, number>();
  private sfxContext?: AudioContext;

  private get audioCacheKey() {
    return 'vocab-audio-cache-v1';
  }

  private get sessionKey() {
    return `vocab-session-${(this.userLogged || 'anon').trim()}`;
  }

  ngOnInit() {
    this.userLogged = localStorage.getItem('userLogged') || '';
    this.scores = this.read<Score[]>('vocab-scores-v1', []);
    this.audioCache = new Map(Object.entries(this.read<Record<string, string>>(this.audioCacheKey, {})));
    this.restoreSession();
    fetch('/words.json')
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

  private saveSession() {
    if (this.finished || !this.queue.length) return;
    localStorage.setItem(this.sessionKey, JSON.stringify({
      lang: this.lang,
      queue: this.queue,
      idx: this.idx,
      right: this.right,
      wrong: this.wrong,
      elapsed: this.elapsed,
      startedAt: this.startedAt,
      updatedAt: Date.now(),
    }));
  }

  private restoreSession() {
    const saved = this.read<any>(this.sessionKey, null);
    if (!saved || !Array.isArray(saved.queue) || !saved.queue.length) return;
    if (saved.lang === 'pt' || saved.lang === 'en') this.lang = saved.lang;
    this.queue = saved.queue;
    this.idx = Math.min(Math.max(saved.idx || 0, 0), saved.queue.length - 1);
    this.right = saved.right || 0;
    this.wrong = saved.wrong || 0;
    this.elapsed = saved.elapsed || 0;
    this.startedAt = saved.startedAt || Date.now();
    this.resetAudio();
    this.answer = '';
    this.result = null;
    this.paused = false;
    this.finished = false;
    this.resumed = true;
    this.view = 'quiz';
    this.startTimer();
  }

  private clearSession() {
    localStorage.removeItem(this.sessionKey);
  }

  register() {
    if (!this.nameInput.trim() && !localStorage.getItem('userLogged')) return;

    this.userLogged = this.nameInput.trim().toUpperCase();
    localStorage.setItem('userLogged', this.userLogged.trim());
    this.view = 'play';
  }

  logout() {
    localStorage.removeItem('userLogged');
    this.userLogged = '';
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
    this.persistWords([{ id: crypto.randomUUID(), en, pt,
      category: this.category.trim() || undefined,
      pronunciation: this.pronunciation.trim(),
      sentence: this.sentence.trim() || undefined }])
      .then(words => {
        this.sharedWords = [...this.sharedWords, ...words];
        this.en = '';
        this.pt = '';
        this.category = '';
        this.pronunciation = '';
        this.sentence = '';
        // this.message = 'Palavra adicionada ao arquivo words.json.';
        this.message = 'Palavra adicionada com sucesso.';
      })
      .catch(() => (this.message = 'Nao foi possivel salvar. Inicie a API com npm run start:api.'));
  }

  removeWord(id: string) {
    fetch(`/api/words/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to remove word.');
        this.sharedWords = this.sharedWords.filter(word => word.id !== id);
        this.message = 'Palavra removida de words.json.';
      })
      .catch(() => (this.message = 'Nao foi possivel remover. Verifique se a API esta em execucao.'));
  }

  importWords(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text()
      .then(text => file.name.toLowerCase().endsWith('.csv') ? this.parseCsv(text) : JSON.parse(text) as Word[])
      .then(words => {
        // if (!Array.isArray(words) || words.some(word => !word.en || !word.pt)) {
        if (!Array.isArray(words) ) {
          console.log('Invalid vocabulary file.');
          throw new Error('Invalid vocabulary file.');
        }
        return this.persistWords(words.map(word => ({ ...word, id: word.id || crypto.randomUUID() })));
      })
      .then(words => {
        this.sharedWords = [...this.sharedWords, ...words];
        this.message = `${words.length} palavra(s) importada(s) para words.json.`;
      })
      .catch(() => (this.message = 'Arquivo invalido ou API indisponivel. Use JSON/CSV com en e pt.'));
    input.value = '';
  }

private persistWords(words: Word[]): Promise<Word[]> {
    debugger
    return fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words }),
    }).then(async response => {
      console.log(response);

      const body = await response.json() as { words?: Word[] };
      console.log(body);

      if (!response.ok) {
        console.log('Unable to save words.');
          throw new Error('Unable to save words.');
      }
      return body.words || [];
    });
  }

  private parseCsv(text: string): Word[] {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) return [];
    const delimiter = rows[0].includes(';') ? ';' : ',';
    const headers = rows.shift()!.replace(/^\uFEFF/, '').split(delimiter).map(header => header.trim().toLowerCase());
    const enIndex = headers.indexOf('en');
    const ptIndex = headers.indexOf('pt');
    const categoryIndex = headers.indexOf('category');
    const pronunciationIndex = headers.indexOf('pronunciation');
    if (enIndex < 0 || ptIndex < 0) throw new Error('Invalid CSV headers.');
    return rows.map(row => {
      const cells = row.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
      return { id: crypto.randomUUID(), en: cells[enIndex],
        pt: cells[ptIndex],
        category: categoryIndex >= 0 ? cells[categoryIndex] : undefined,
        pronunciation: cells[pronunciationIndex] };
    });
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
    this.resumed = false;
    this.resetAudio();
    this.view = 'quiz';
    this.startTimer();
    this.saveSession();
  }

  get current() {
    return this.queue[this.idx];
  }

  get currentLevel() {
    return this.current?.level?.trim() || '';
  }

  async speak() {
    if (this.audioLoading) return;
    if (!this.current) return;
    this.audioLoading = true;
    this.audioError = '';
    try {
      const url = await this.resolveAudio();
      if (!url) {
        this.speakOffline();
        return;
      }
      this.audioUrl = url;
      this.persistAudioCache();
      this.audio?.pause();
      this.audio = new Audio(url);
      this.audio.addEventListener('error', () => {
        this.audioError = 'Audio indisponivel no momento.';
        this.audioFailures.set(this.termForAudio().toLowerCase(), Date.now());
        this.audioUrl = '';
      });
      await this.playWithRetry(this.audio, 0);
    } catch {
      this.audioError = 'Nao foi possivel tocar o audio.';
    } finally {
      this.audioLoading = false;
    }
  }

  private async resolveAudio(): Promise<string> {
    const term = this.termForAudio();
    if (!term) return '';
    const key = term.toLowerCase();
    const cached = this.audioCache.get(key);
    if (cached) return cached;

    // Ordem testada em 28/09/2026: Wiktionary responde de forma confiavel e com
    // cobertura alta; dictionaryapi.dev e lenta/ intermitente; responsivevoice esta fora do ar.
    const providers: Array<() => Promise<string>> = [
      () => this.fromWiktionary(key),
      () => this.fromDictionaryApi(key),
      () => this.fromResponsiveVoice(key),
    ];

    for (const provider of providers) {
      try {
        const url = await provider();
        if (url) {
          this.audioCache.set(key, url);
          this.audioFailures.delete(key);
          this.persistAudioCache();
          return url;
        }
      } catch {
        // tenta o proximo provedor
      }
    }

    // Nenhum provedor respondeu: repete a cadeia completa em uma segunda rodada.
    for (const provider of providers) {
      try {
        const url = await provider();
        if (url) {
          this.audioCache.set(key, url);
          this.audioFailures.delete(key);
          this.persistAudioCache();
          return url;
        }
      } catch {
        // ignora
      }
    }

    this.audioFailures.set(key, Date.now());
    return '';
  }

  private async fromDictionaryApi(key: string): Promise<string> {
    const entries = await this.requestJson(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,
    );
    if (!Array.isArray(entries)) return '';
    for (const entry of entries) {
      for (const phonetic of entry.phonetics || []) {
        if (phonetic.audio) return phonetic.audio as string;
      }
    }
    return '';
  }

  private async fromWiktionary(key: string): Promise<string> {
    const title = key.replace(/_/g, ' ');
    const data = await this.requestJson(
      `https://en.wiktionary.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`,
    );
    const items = (data as { items?: any[] })?.items || [];
    const names = items
      .filter((item: any) => item.type === 'audio' && typeof item.title === 'string')
      .map((item: any) => item.title.replace(/^File:/i, ''))
      // prioriza variantes americana/britanica antes de outros idiomas
      .filter((name: string) => /^(en-us|en-uk|en-us-|en-uk-|us-|uk-|en[-_])/i.test(name))
      .sort((a: string, b: string) => a.length - b.length);
    const pick = names[0] || items.find((item: any) => item.type === 'audio')?.title;
    if (!pick) return '';
    const url = `https://en.wiktionary.org/wiki/Special:FilePath/${encodeURIComponent(
      pick.replace(/^File:/i, ''),
    )}`;
    return (await this.urlPlayable(url)) ? url : '';
  }

  private async fromResponsiveVoice(key: string): Promise<string> {
    const cached = this.audioCache.get(`rv:${key}`);
    if (cached) return cached;
    const url = `https://voice-responsive.com/responsivevoice.php?text=${encodeURIComponent(key)}&lang=en`;
    const ok = await this.urlPlayable(url);
    this.audioCache.set(`rv:${key}`, url);
    this.persistAudioCache();
    return ok ? url : '';
  }

  private urlPlayable(url: string) {
    return new Promise<boolean>(resolve => {
      const probe = new Audio();
      const done = (value: boolean) => {
        probe.oncanplaythrough = null;
        probe.onerror = null;
        resolve(value);
      };
      probe.addEventListener('canplaythrough', () => done(true), { once: true });
      probe.addEventListener('error', () => done(false), { once: true });
      probe.src = url;
      probe.load();
      setTimeout(() => done(false), 8000);
    });
  }

  private async playWithRetry(audio: HTMLAudioElement, attempt: number) {
    try {
      await audio.play();
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      audio.load();
      await this.playWithRetry(audio, attempt + 1);
    }
  }

  private termForAudio() {
    const word = this.current;
    if (!word) return '';
    const term = (word.en || word.pt || '').replace(/\s*\/\s*/g, ' ').trim();
    return term;
  }

  private speakOffline() {
    const term = this.termForAudio();
    if (!term || !('speechSynthesis' in window)) {
      this.audioError = 'Sem audio disponivel.';
      return;
    }
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.lang = 'en-US';
    const voice = speechSynthesis.getVoices().find(item => item.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    this.audioError = '';
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  /** Sons curtos de acerto/erro sintetizados via Web Audio (sem arquivos externos). */
  private playFeedback(correct: boolean) {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!this.sfxContext) {
        this.sfxContext = new Ctx() as AudioContext;
      }
      const ctx = this.sfxContext;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = correct ? [660, 880, 1180] : [300, 190];
      const noteLength = correct ? 0.1 : 0.16;
      const type: OscillatorType = correct ? 'sine' : 'sawtooth';

      notes.forEach((frequency, index) => {
        const start = ctx.currentTime + index * noteLength;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        const peak = correct ? 0.16 : 0.12;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + noteLength + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + noteLength + 0.08);
      });
    } catch {
      // audio de feedback e opcional
    }
  }

  private persistAudioCache() {
    localStorage.setItem(this.audioCacheKey, JSON.stringify(Object.fromEntries(this.audioCache)));
  }

  private async requestJson(url: string, attempts = 2): Promise<any> {
    let lastError: any;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        lastError = err;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('Request failed.');
  }

  private resetAudio() {
    this.audio?.pause();
    this.audio = undefined;
    this.audioUrl = '';
    this.audioError = '';
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

    let expectedNormalized = normalize(this.expected);
    let arr = expectedNormalized.split(' / ');

    const correct = arr.includes(normalize(this.answer));
    this.result = { correct, expected: this.expected };
    correct ? this.right++ : this.wrong++;
    this.playFeedback(correct);
    this.saveSession();
  }

  previous() {
    if (this.idx > 0) {
      this.idx--;
      this.resetAudio();
      this.answer = '';
      this.result = null;
      this.saveSession();
    }
  }

  next() {
    this.resetAudio();
    this.idx++;
    this.answer = '';
    this.result = null;
    if (this.idx >= this.queue.length) {
      this.complete();
    } else {
      this.saveSession();
    }
  }


  back() {
    this.previous();
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
      id: crypto.randomUUID(), user: this.userLogged || '', lang: this.lang, right: this.right, wrong: this.wrong,
      total: this.queue.length, durationSeconds: this.elapsed, startedAt: this.startedAt,
      finishedAt: Date.now(), at: Date.now(),
    };
    this.scores = [score, ...this.scores];
    localStorage.setItem('vocab-scores-v1', JSON.stringify(this.scores));
    this.clearSession();
    this.resumed = false;
  }

  restart() {
    this.start(this.lang);
  }

  startTimer() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!this.paused && !this.finished) {
        this.elapsed++;
        this.saveSession();
      }
    }, 1000);
  }

  duration(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  percent(score: Score) {
    return score.total ? Math.round((score.right / score.total) * 100) : 0;
  }
}
