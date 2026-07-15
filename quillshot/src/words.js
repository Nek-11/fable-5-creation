// ~650 common lowercase words, bucketed by length.
// Tier 0: 2-3 letters · Tier 1: 4-6 · Tier 2: 7-9 · Tier 3: 10+
// Boss sentences live at the bottom.

export const WORD_TIERS = [
  // ---- tier 0: 2-3 letters ----
  [
    'ace', 'act', 'add', 'age', 'aim', 'air', 'ant', 'ape', 'arc', 'arm',
    'art', 'ash', 'ask', 'awe', 'axe', 'bag', 'ban', 'bar', 'bat', 'bay',
    'bed', 'bee', 'big', 'bin', 'bit', 'bow', 'box', 'boy', 'bud', 'bug',
    'bun', 'bus', 'buy', 'cab', 'can', 'cap', 'car', 'cat', 'cog', 'cow',
    'cry', 'cub', 'cup', 'cut', 'day', 'den', 'dew', 'dig', 'dim', 'dip',
    'dog', 'dot', 'dry', 'dug', 'ear', 'eat', 'eel', 'egg', 'elf', 'elk',
    'elm', 'end', 'era', 'eye', 'fan', 'far', 'fig', 'fin', 'fit', 'fix',
    'fly', 'foe', 'fog', 'fox', 'fun', 'fur', 'gap', 'gas', 'gem', 'get',
    'gum', 'gut', 'guy', 'gym', 'ham', 'hat', 'hay', 'hen', 'hid', 'hip',
    'hog', 'hop', 'hot', 'hub', 'hue', 'hug', 'hum', 'hut', 'ice', 'imp',
    'ink', 'inn', 'ivy', 'jab', 'jam', 'jar', 'jaw', 'jet', 'jig', 'job',
    'jog', 'joy', 'jug', 'keg', 'key', 'kid', 'kit', 'lab', 'lad', 'lap',
    'law', 'leg', 'lid', 'lip', 'log', 'low', 'mad', 'map', 'mat', 'mix',
    'mob', 'mop', 'mud', 'mug', 'nab', 'nap', 'net', 'new', 'nod', 'nut',
    'oak', 'oar', 'odd', 'oil', 'owl', 'own', 'pad', 'pan', 'paw', 'pea',
    'peg', 'pen', 'pet', 'pie', 'pig', 'pin', 'pit', 'pod', 'pot', 'pun',
    'pup', 'rag', 'ram', 'rat', 'raw', 'ray', 'red', 'rib', 'rig', 'rim',
    'rip', 'rod', 'rot', 'row', 'rub', 'rug', 'run', 'rye', 'sad', 'sap',
    'saw', 'sea', 'sew', 'shy', 'sip', 'sit', 'six', 'ski', 'sky', 'sly',
    'sob', 'spa', 'spy', 'sum', 'sun', 'tab', 'tag', 'tan', 'tap', 'tar',
    'tax', 'tea', 'tie', 'tin', 'tip', 'toe', 'top', 'tow', 'toy', 'tub',
    'tug', 'urn', 'van', 'vat', 'vet', 'vow', 'wag', 'wax', 'web', 'wig',
    'win', 'wit', 'wok', 'yak', 'yam', 'zap', 'zig', 'zip', 'zoo', 'oat',
  ],
  // ---- tier 1: 4-6 letters ----
  [
    'able', 'acorn', 'acre', 'agent', 'alarm', 'alien', 'alley', 'amber', 'anchor', 'angle',
    'ankle', 'anvil', 'apple', 'apron', 'arena', 'argue', 'arrow', 'aspen', 'atlas', 'attic',
    'autumn', 'awake', 'bacon', 'badge', 'bagel', 'baker', 'bamboo', 'banjo', 'barley', 'barn',
    'basil', 'basket', 'beach', 'beacon', 'beast', 'beetle', 'bell', 'belt', 'bench', 'berry',
    'birch', 'bison', 'blade', 'blaze', 'blend', 'blink', 'bloom', 'blush', 'board', 'bolt',
    'bonus', 'book', 'boot', 'bottle', 'bounce', 'brave', 'bread', 'breeze', 'brick', 'bridge',
    'bright', 'brook', 'broom', 'brush', 'bubble', 'bucket', 'buckle', 'bundle', 'burrow', 'butter',
    'button', 'cabin', 'cable', 'cactus', 'camel', 'camera', 'candle', 'candy', 'canoe', 'canyon',
    'cargo', 'carpet', 'carrot', 'castle', 'cedar', 'cellar', 'chalk', 'charm', 'chart', 'chase',
    'cheese', 'cherry', 'chess', 'chest', 'chill', 'chime', 'churn', 'cider', 'circle', 'clay',
    'cliff', 'cloak', 'clock', 'cloud', 'clover', 'coast', 'cobra', 'cocoa', 'comet', 'copper',
    'coral', 'cotton', 'couch', 'cousin', 'cradle', 'crane', 'crate', 'creek', 'crisp', 'crumb',
    'crust', 'curve', 'cycle', 'dagger', 'dairy', 'dance', 'dawn', 'deer', 'delta', 'denim',
    'depth', 'desk', 'dime', 'dinner', 'ditch', 'dome', 'donkey', 'door', 'dough', 'dozen',
    'dragon', 'drift', 'drum', 'dune', 'dusk', 'dust', 'eagle', 'earth', 'easel', 'echo',
    'edge', 'elbow', 'ember', 'engine', 'envy', 'fable', 'falcon', 'fang', 'farm', 'feast',
    'fence', 'fern', 'ferry', 'fever', 'field', 'fiddle', 'fire', 'flag', 'flame', 'flask',
    'fleet', 'flint', 'flock', 'flour', 'flute', 'foam', 'forest', 'forge', 'fossil', 'frost',
    'fruit', 'gale', 'garden', 'garlic', 'gaze', 'gecko', 'ghost', 'giant', 'ginger', 'glade',
    'glass', 'globe', 'glove', 'gold', 'goose', 'grain', 'grape', 'grass', 'gravel', 'grove',
    'guard', 'guitar', 'gull', 'gust', 'hammer', 'harbor', 'harp', 'hatch', 'hawk', 'hazel',
    'heart', 'hedge', 'helmet', 'herb', 'heron', 'hill', 'hollow', 'honey', 'hood', 'hoof',
    'horn', 'horse', 'house', 'husk', 'igloo', 'iron', 'island', 'ivory', 'jacket', 'jelly',
    'jewel', 'jungle', 'kayak', 'kettle', 'king', 'kite', 'knight', 'knot', 'ladder', 'lagoon',
    'lake', 'lance', 'lark', 'latch', 'leaf', 'ledge', 'lemon', 'level', 'lever', 'light',
    'lilac', 'lily', 'lime', 'linen', 'lion', 'lizard', 'llama', 'lodge', 'loft', 'lunar',
    'lute', 'magnet', 'mango', 'mantle', 'maple', 'marble', 'market', 'mask', 'meadow', 'melon',
    'mill', 'mint', 'mirror', 'noble', 'north', 'nutmeg', 'oasis', 'ocean', 'olive', 'onion',
    'opal', 'orbit', 'otter', 'oxen', 'paddle', 'palace', 'panda', 'pantry', 'parade', 'peach',
    'pearl', 'pebble', 'pecan', 'pepper', 'pigeon', 'pillow', 'pine', 'pirate', 'plank', 'plum',
    'pocket', 'pond', 'poppy', 'prism', 'prune', 'puddle', 'pulley', 'puppet', 'quartz', 'quest',
    'quill', 'quilt', 'rabbit', 'raft', 'raven', 'reef', 'ribbon', 'ridge', 'river', 'robin',
    'rocket', 'rope', 'saddle', 'salmon', 'sand', 'scale', 'scarf', 'school', 'scout', 'scroll',
    'shadow', 'shell', 'shield', 'shore', 'shovel', 'silver', 'sketch', 'slate', 'sleigh', 'smoke',
    'snail', 'socket', 'spear', 'spice', 'spiral', 'spoon', 'spring', 'spruce', 'squash', 'squire',
    'stable', 'stone', 'storm', 'stove', 'straw', 'stream', 'street', 'string', 'summit', 'sunset',
    'swamp', 'swan', 'sword', 'syrup', 'table', 'talon', 'tavern', 'temple', 'thorn', 'thread',
    'tiger', 'timber', 'torch', 'tower', 'trail', 'tree', 'tribe', 'trout', 'trunk', 'tulip',
    'tunnel', 'turnip', 'turtle', 'twig', 'umber', 'valley', 'vapor', 'vault', 'velvet', 'vessel',
    'vine', 'violet', 'wagon', 'walnut', 'wasp', 'water', 'weave', 'whale', 'wheat', 'wheel',
    'willow', 'window', 'winter', 'wolf', 'wonder', 'world', 'woven', 'wren', 'yarn', 'yeast',
    'zebra', 'zephyr',
  ],
  // ---- tier 2: 7-9 letters ----
  [
    'academy', 'acrobat', 'admiral', 'airship', 'alchemy', 'almanac', 'anchovy', 'antique', 'apricot', 'archery',
    'armchair', 'asteroid', 'avalanche', 'bagpipes', 'balcony', 'banquet', 'barnacle', 'bassoon', 'bayonet', 'bedrock',
    'beehive', 'believe', 'beneath', 'between', 'bicycle', 'biscuit', 'blanket', 'blizzard', 'blossom', 'bonfire',
    'boulder', 'bouquet', 'bracken', 'bravery', 'broccoli', 'buffalo', 'bulwark', 'cabbage', 'caboose', 'calendar',
    'campfire', 'capsule', 'caravan', 'cardinal', 'carnival', 'carousel', 'cascade', 'cathedral', 'cauldron', 'ceiling',
    'century', 'ceramic', 'chamber', 'channel', 'chapter', 'charcoal', 'chariot', 'checkers', 'chestnut', 'chimney',
    'cinnamon', 'citadel', 'citizen', 'clarinet', 'climate', 'coconut', 'compass', 'concert', 'conductor', 'conjure',
    'corridor', 'costume', 'cottage', 'courage', 'cranberry', 'crescent', 'crevice', 'cricket', 'crossbow', 'crumpet',
    'culvert', 'currant', 'cyclone', 'daffodil', 'deckhand', 'diagram', 'diamond', 'dinosaur', 'dolphin', 'doorbell',
    'dovetail', 'dragonfly', 'driftwood', 'drizzle', 'dulcimer', 'dungeon', 'eclipse', 'elephant', 'elevator', 'emerald',
    'envelope', 'evergreen', 'falconer', 'fanfare', 'festival', 'firefly', 'fireside', 'flagship', 'flamingo', 'footpath',
    'fortress', 'fountain', 'foxglove', 'freckle', 'frigate', 'furnace', 'galleon', 'gargoyle', 'gazette', 'giraffe',
    'glacier', 'goulash', 'granite', 'gravity', 'gryphon', 'gumdrop', 'hammock', 'harvest', 'hedgehog', 'heirloom',
    'hemlock', 'hickory', 'horizon', 'hurricane', 'inkwell', 'ironwood', 'jackdaw', 'jasmine', 'javelin', 'journey',
    'jubilee', 'juniper', 'keepsake', 'keyboard', 'kindling', 'kingdom', 'labyrinth', 'lakeside', 'lantern', 'lavender',
    'leather', 'library', 'limerick', 'lionfish', 'lodestone', 'longbow', 'magician', 'mahogany', 'mandolin', 'maritime',
    'meridian', 'midnight', 'molasses', 'monolith', 'monsoon', 'moonbeam', 'minstrel', 'mountain', 'mustang', 'mystery',
    'narwhal', 'nocturne', 'noodles', 'oakwood', 'obsidian', 'octopus', 'orchard', 'organism', 'oregano', 'outpost',
    'paladin', 'panther', 'papyrus', 'parapet', 'parchment', 'pavilion', 'pelican', 'pendulum', 'penguin', 'pinwheel',
    'porridge', 'postcard', 'prairie', 'pyramid', 'quibble', 'quicksand', 'quartet', 'rainbow', 'rampart', 'redwood',
    'reindeer', 'saffron', 'sailboat', 'satchel', 'scabbard', 'seashell', 'sentinel', 'signpost', 'skirmish', 'snowdrift',
    'sparrow', 'spyglass', 'stampede', 'starling', 'sundial', 'tempest', 'theater', 'thicket', 'thimble', 'thunder',
    'tinderbox', 'trellis', 'triangle', 'trombone', 'twilight', 'vanguard', 'varnish', 'verdant', 'village', 'vulture',
    'warbler', 'warhorse', 'waterfall', 'westward', 'whirlpool', 'whistle', 'wildwood', 'windward', 'wisteria', 'wizardry',
  ],
  // ---- tier 3: 10+ letters ----
  [
    'adventurous', 'apothecary', 'archipelago', 'astonishing', 'atmosphere', 'blackberry', 'blacksmith', 'calligraphy', 'candlelight', 'cartography',
    'catastrophe', 'celebration', 'chandelier', 'clockmaker', 'cobblestone', 'combination', 'conversation', 'countryside', 'courageous', 'decoration',
    'dictionary', 'drawbridge', 'earthenware', 'embroidery', 'enchantment', 'expedition', 'firecracker', 'generation', 'gingerbread', 'gooseberry',
    'grandmother', 'grasshopper', 'handwriting', 'harpsichord', 'helicopter', 'hibernation', 'honeysuckle', 'horseradish', 'illustration', 'imagination',
    'lighthouse', 'locomotive', 'lumberjack', 'marketplace', 'masquerade', 'meadowlark', 'mockingbird', 'motorcycle', 'mysterious', 'nightingale',
    'overgrowth', 'parliament', 'peppermint', 'percussion', 'philosopher', 'pomegranate', 'quicksilver', 'rattlesnake', 'reflection', 'salamander',
    'sandcastle', 'silhouette', 'skyscraper', 'snapdragon', 'spectacular', 'springtime', 'stalactite', 'stonemason', 'strawberry', 'switchboard',
    'thunderclap', 'thunderstorm', 'tumbleweed', 'typewriter', 'underbrush', 'understand', 'watercolor', 'watermelon', 'weathervane', 'wilderness',
    'wintergreen', 'woodpecker',
  ],
];

// Boss taunts — typed one word at a time, in order.
export const BOSS_SENTENCES = [
  ['you', 'type', 'like', 'a', 'farmer'],
  ['my', 'army', 'is', 'endless'],
  ['arrows', 'cannot', 'stop', 'the', 'dark'],
  ['kneel', 'before', 'the', 'stick', 'king'],
  ['your', 'quiver', 'runs', 'dry', 'tonight'],
  ['this', 'field', 'will', 'be', 'your', 'grave'],
  ['no', 'word', 'can', 'save', 'you'],
  ['i', 'have', 'eaten', 'better', 'archers'],
  ['spell', 'doom', 'if', 'you', 'dare'],
  ['every', 'letter', 'brings', 'you', 'closer'],
];

// Pick a random word from a tier, avoiding a set of banned first letters
// (so no two visible enemies ever start with the same key).
export function pickWord(tier, bannedFirstLetters, rng = Math.random) {
  const bucket = WORD_TIERS[Math.max(0, Math.min(WORD_TIERS.length - 1, tier))];
  for (let i = 0; i < 60; i++) {
    const w = bucket[(rng() * bucket.length) | 0];
    if (!bannedFirstLetters.has(w[0])) return w;
  }
  // banned set covers the whole alphabet (or bad luck) — return anything.
  return bucket[(rng() * bucket.length) | 0];
}

// ------------------------------------------------------------- EXTREME mode
// Decipherment torture: strings built from confusable glyph groups. Every
// character is typable on a standard keyboard; case matters.
const CONFUSABLES = ['0O', '1lI', '5S', '8B', '2Z'];
const FILLER = 'aceghjkmnpqrtuvwxy'; // letters that never read as digits
const TIER_LEN = [
  [2, 3],
  [4, 6],
  [7, 9],
  [10, 12],
];

// e.g. "l0Il1", "S5O0B8", "x1I0q"
export function cipherWord(tier, bannedFirstChars, rng = Math.random) {
  const [lo, hi] = TIER_LEN[Math.max(0, Math.min(TIER_LEN.length - 1, tier))];
  for (let attempt = 0; attempt < 60; attempt++) {
    const len = lo + ((rng() * (hi - lo + 1)) | 0);
    // one or two confusable groups dominate each word — that's the cruelty
    const g1 = CONFUSABLES[(rng() * CONFUSABLES.length) | 0];
    const g2 = CONFUSABLES[(rng() * CONFUSABLES.length) | 0];
    let w = '';
    for (let i = 0; i < len; i++) {
      const r = rng();
      if (r < 0.42) w += g1[(rng() * g1.length) | 0];
      else if (r < 0.72) w += g2[(rng() * g2.length) | 0];
      else {
        const c = FILLER[(rng() * FILLER.length) | 0];
        w += rng() < 0.3 ? c.toUpperCase() : c;
      }
    }
    if (!bannedFirstChars.has(w[0])) return w;
  }
  return '0O' + FILLER[(rng() * FILLER.length) | 0];
}

// Short full sentences with punctuation, typed exactly (plain ASCII only).
const CIPHER_SENTENCES = [
  'the Owl saw 0 owls.',
  'I ate 8 Bagels, twice.',
  'l0se the 1st arrow!',
  'Zero is 0, not O.',
  '5 Snakes hiss: S5S.',
  'B8 the hook, B0b.',
  'One 1, two 2, go!',
  'It is I, number 1.',
  'S0 it g0es.',
  'call me Il1ad.',
];

export function cipherSentence(bannedFirstChars, rng = Math.random) {
  for (let i = 0; i < 30; i++) {
    const s = CIPHER_SENTENCES[(rng() * CIPHER_SENTENCES.length) | 0];
    if (!bannedFirstChars.has(s[0])) return s;
  }
  return CIPHER_SENTENCES[(rng() * CIPHER_SENTENCES.length) | 0];
}
