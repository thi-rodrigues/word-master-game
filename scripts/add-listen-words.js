/**
 * Adiciona entradas na categoria "Palavras" derivadas das frases da categoria
 * "LISTEN A MINUTE.com". Nenhum item existente e removido ou alterado:
 * o script apenas faz append de objetos novos ao final do array.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const wordsFile = path.join(__dirname, "..", "public", "words.json");

// palavra em ingles -> { pt, pronunciation, level }
const DICT = {
  a: ["um / uma", "ei", "A1"],
  ahead: ["adiante", "ahîid", "A2"],
  air: ["ar", "ér", "A1"],
  all: ["todo / todos", "ól", "A1"],
  am: ["sou / estou", "âm", "A1"],
  and: ["e", "ând", "A1"],
  animal: ["animal", "â-ni-mál", "A1"],
  as: ["como / enquanto", "éz", "A2"],
  awareness: ["conscientização", "awér-nés", "B1"],
  bad: ["ruim / mau", "béd", "A1"],
  be: ["ser / estar", "bi", "A1"],
  better: ["melhor", "bétâr", "A1"],
  boost: ["impulso / injeção", "búst", "B1"],
  bright: ["brilhante / ensolarado", "bráit", "A2"],
  by: ["por", "bái", "A1"],
  card: ["cartão", "kárd", "A1"],
  "car-dominated": ["dominado por carros", "kár dáminêitid", "B2"],
  cash: ["dinheiro em espécie", "kásh", "B1"],
  cause: ["causar", "kóz", "B1"],
  caves: ["cavernas", "kêivz", "A2"],
  chance: ["chance / oportunidade", "cháns", "A2"],
  "coin-operated": ["movido a moedas", "koin ópərêitid", "B2"],
  coins: ["moedas", "kóins", "A2"],
  covering: ["cobrindo", "kâvâr-ing", "B1"],
  crazy: ["louco", "kréizi", "A2"],
  cutting: ["de ponta", "kâting", "B1"],
  "cyber-crime": ["crime cibernético", "sáibâr kráim", "B1"],
  damage: ["dano / prejuízo", "dâmij", "B1"],
  danger: ["perigo", "dêindjâr", "A2"],
  date: ["data", "dêit", "A2"],
  day: ["dia", "dêi", "A1"],
  details: ["detalhes / dados", "ditêis", "A2"],
  devices: ["dispositivos / aparelhos", "diváisis", "A2"],
  down: ["para baixo", "dáun", "A1"],
  drained: ["esgotado", "drêind", "B1"],
  drastically: ["drasticamente", "drástikli", "B2"],
  dull: ["nublado / sem brilho", "dâl", "B1"],
  dying: ["morrendo / extinto", "dái-ing", "B1"],
  each: ["cada", "ítch", "A2"],
  edge: ["ponta / borda", "édj", "B1"],
  energetic: ["enérgico", "enərdjétik", "B1"],
  energy: ["energia", "énârji", "A2"],
  even: ["mesmo / até", "íven", "A2"],
  ever: ["alguma vez / já", "évâr", "A2"],
  fall: ["cair / queda", "fól", "A2"],
  fellow: ["colega / companheiro", "félou", "B1"],
  for: ["para / por", "fór", "A1"],
  "freely-expressed": ["livremente expresso", "fríli expréssid", "C1"],
  full: ["cheio", "fúl", "A2"],
  future: ["futuro", "fiútchâr", "A2"],
  gamers: ["jogadores", "guêimârs", "B1"],
  gimmick: ["truque passageiro", "guímik", "C1"],
  go: ["ir / vai", "góu", "A1"],
  "graphics-packed": ["cheio de gráficos", "gráfiks pákt", "B2"],
  habitat: ["hábitat", "hábitat", "B1"],
  happens: ["acontece", "hápenz", "B1"],
  have: ["ter / possuir", "hév", "A1"],
  health: ["saúde", "hélth", "A2"],
  heard: ["ouviu / ouvi", "hêrd", "A2"],
  hits: ["atinge / chega", "hits", "A2"],
  how: ["como", "háu", "A1"],
  huge: ["enorme", "híudj", "B1"],
  i: ["eu", "ái", "A1"],
  if: ["se", "íf", "A1"],
  in: ["em / dentro de", "in", "A2"],
  it: ["isso / isto", "it", "A1"],
  kinds: ["tipos", "káindz", "A2"],
  kingdom: ["reino", "kíngdâm", "A2"],
  law: ["lei", "ló", "B1"],
  leapt: ["saltou / avançou", "lêpt", "B2"],
  levels: ["níveis", "lêvais", "A2"],
  live: ["viver / morar", "liv", "A2"],
  lives: ["vidas", "láivz", "B1"],
  living: ["vivendo", "líving", "A2"],
  miles: ["milhas", "máils", "B1"],
  model: ["modelo", "mádâl", "B1"],
  move: ["mover / movimento", "múv", "A2"],
  much: ["muito", "mâtch", "A2"],
  natural: ["natural", "nátchural", "B1"],
  notes: ["cédulas / notas", "nóts", "A2"],
  number: ["número", "námbar", "A2"],
  of: ["de", "ôv", "A1"],
  on: ["em / sobre", "ón", "A2"],
  once: ["uma vez", "uâns", "A2"],
  one: ["um / uma", "uân", "A1"],
  "one-day": ["de um dia só", "uân déi", "B2"],
  ordinary: ["comum / ordinário", "órdinari", "B1"],
  other: ["outro", "âder", "A1"],
  others: ["outros", "âders", "A2"],
  out: ["fora", "áut", "A2"],
  part: ["parte", "párt", "A2"],
  participation: ["participação", "partisipeíshn", "B1"],
  pay: ["pagar", "péi", "A1"],
  people: ["pessoas", "pípal", "A1"],
  purchase: ["compra", "pârtchas", "B1"],
  rainy: ["chuvoso", "réini", "A2"],
  raise: ["aumentar / erguer", "reiz", "B1"],
  ready: ["pronto", "rédi", "A2"],
  reason: ["razão / motivo", "ríson", "B1"],
  rely: ["depender", "rilái", "B1"],
  replace: ["substituir", "ripléis", "B1"],
  respect: ["respeito", "rispékt", "B1"],
  risk: ["risco / arriscar", "risk", "B1"],
  seems: ["parece", "símz", "A2"],
  shelves: ["prateleiras", "shélvz", "A2"],
  short: ["curto", "short", "A2"],
  single: ["único / solteiro", "síngal", "A2"],
  sizeable: ["considerável", "sáizâbal", "B2"],
  so: ["então / portanto", "sóu", "A2"],
  society: ["sociedade", "sosáiâtei", "B1"],
  some: ["alguns / alguns", "sâm", "A1"],
  species: ["espécies", "spíshiz", "B1"],
  spy: ["espionar / espião", "spái", "B1"],
  streets: ["ruas", "stríts", "B1"],
  summed: ["resumiu", "sâmd", "B2"],
  sunny: ["ensolarado", "sâni", "A2"],
  switch: ["mudar / ligar", "swích", "B1"],
  take: ["pegar / levar", "téik", "A1"],
  that: ["que / isso", "dhét", "A2"],
  the: ["o / a", "dhé", "A1"],
  their: ["deles / delas", "dhéir", "A1"],
  them: ["eles / elas", "dhém", "A1"],
  thing: ["coisa", "dhing", "A2"],
  things: ["coisas", "dhings", "A2"],
  though: ["embora", "dhôu", "A2"],
  to: ["para / que", "tu", "A1"],
  towards: ["em direção a", "tuwórds", "B1"],
  turned: ["virou / reduziu", "têrnd", "B2"],
  tv: ["televisão", "tiví", "A1"],
  unclogged: ["desobstruídas", "ânklôguid", "B2"],
  up: ["para cima", "âp", "A1"],
  war: ["guerra", "uór", "B1"],
  way: ["maneira", "uéi", "A1"],
  we: ["nós", "uí", "A1"],
  what: ["o que", "uót", "A1"],
  where: ["onde", "uér", "A2"],
  wild: ["selvagem / natureza", "uáild", "B1"],
  will: ["vai / quer", "wil", "A2"],
  within: ["dentro de", "uidín", "B1"],
  without: ["sem", "uidáut", "A2"],
  world: ["mundo", "uérld", "A2"],
  would: ["iria / faria", "wud", "A1"],
  you: ["você", "iú", "A1"],
  your: ["seu / sua", "ióor", "A1"],
};

const raw = fs.readFileSync(wordsFile, "utf8");
const data = JSON.parse(raw);
const before = data.length;

// remove duplicatas (caso o script seja rodado mais de uma vez)
const seen = new Set(data.map((w) => String(w.en).toLowerCase().trim()));
const additions = [];

for (const [en, [pt, pronunciation, level]] of Object.entries(DICT)) {
  if (seen.has(en)) continue;
  seen.add(en);
  additions.push({
    id: `lam-${en.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    en,
    pt,
    category: "Palavras",
    pronunciation,
    sentence: "",
    level,
  });
}

if (!additions.length) {
  console.log("Nada a adicionar. Total mantido:", data.length);
  process.exit(0);
}

data.push(...additions);
fs.writeFileSync(wordsFile, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`Antes: ${before} | Adicionados: ${additions.length} | Depois: ${data.length}`);
