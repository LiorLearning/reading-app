// Deterministic, child-safe interest extraction
// Extracts from a single user message using a whitelist and basic token matching

const CANONICAL_INTERESTS = [
  'dinosaurs','robots','cars','trucks','trains','airplanes','planes','spaceships','space','astronauts','stars','planets',
  'unicorns','dragons','magic','wizards','princess','princesses','superheroes','ninja','pirates',
  'football','soccer','cricket','basketball','racing','running','swimming',
  'animals','cats','dogs','horses','tigers','lions','sharks','fish','birds',
  'drawing','painting','art','crafts','lego','building','blocks','puzzles',
  'music','dance','singing','piano','guitar','drums',
  'baking','cooking','cookies','cake','candy','chocolate','ice cream',
  'slime','bubbles','sparkle','fairies','monsters','zombies'
] as const;

const SYNONYM_MAP: Record<string, string> = {
  plane: 'airplanes',
  airplane: 'airplanes',
  car: 'cars',
  truck: 'trucks',
  train: 'trains',
  spaceship: 'spaceships',
  astronaut: 'astronauts',
  star: 'stars',
  planet: 'planets',
  unicorn: 'unicorns',
  dragon: 'dragons',
  wizard: 'wizards',
  superhero: 'superheroes',
  pirate: 'pirates',
  princess: 'princess',
  kitty: 'cats',
  cat: 'cats',
  dog: 'dogs',
  horse: 'horses',
  tiger: 'tigers',
  lion: 'lions',
  shark: 'sharks',
  bird: 'birds',
  fish: 'fish',
  art: 'art',
  craft: 'crafts',
  lego: 'lego',
  block: 'blocks',
  puzzle: 'puzzles',
  music: 'music',
  dance: 'dance',
  sing: 'singing',
  piano: 'piano',
  guitar: 'guitar',
  drum: 'drums',
  bake: 'baking',
  cook: 'cooking',
  cookie: 'cookies',
  cake: 'cake',
  candy: 'candy',
  chocolate: 'chocolate',
  slime: 'slime',
  bubble: 'bubbles',
  fairy: 'fairies',
  monster: 'monsters',
  zombie: 'zombies',
  soccer: 'soccer',
  football: 'football',
  cricket: 'cricket',
  basketball: 'basketball',
  race: 'racing',
  running: 'running',
  swim: 'swimming',
  building: 'building',
} as const;

function normalizeToken(token: string): string | null {
  const t = token.toLowerCase().trim();
  if (!t) return null;
  if (SYNONYM_MAP[t]) return SYNONYM_MAP[t];
  return t;
}

export function extractInterestsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const lowered = text.toLowerCase();
  const tokens = lowered
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .filter((t): t is string => !!t);

  const whitelist = new Set<string>(CANONICAL_INTERESTS as unknown as string[]);
  const found = new Set<string>();

  // direct matches
  for (const token of tokens) {
    if (whitelist.has(token)) {
      found.add(token);
    }
  }

  // simple bigrams (e.g., 'ice cream')
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (bigram === 'ice cream') {
      found.add('ice cream');
    }
  }

  // cap to top 3 unique interests per message
  return Array.from(found).slice(0, 3);
}

export function normalizeInterests(interests: string[]): string[] {
  const set = new Set<string>();
  for (const it of interests) {
    const norm = normalizeToken(it || '');
    if (!norm) continue;
    set.add(norm);
  }
  return Array.from(set);
}


