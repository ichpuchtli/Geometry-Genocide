import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const gridWarsRoot = path.join(repoRoot, 'docs', 'GridWars54');
const outDir = path.join(repoRoot, 'docs', 'gridwars-research');

const IMAGE_ROLE_MAP = {
  greensquare: { kind: 'enemy', role: 'Shy the Square' },
  purplesquare1: { kind: 'enemy', role: 'Cubie the Cube frame A' },
  purplesquare2: { kind: 'enemy', role: 'Cubie the Cube frame B' },
  bluediamond: { kind: 'enemy', role: 'Dimmy the Diamond' },
  pinkpinwheel: { kind: 'enemy', role: 'Paul the Pinwheel' },
  indigotriangle: { kind: 'enemy', role: 'Indy the Butterfly' },
  bluecircle: { kind: 'enemy', role: 'Sammy the Seeker' },
  redclone: { kind: 'enemy', role: 'Ivan the Interceptor' },
  orangetriangle: { kind: 'enemy', role: 'Trish the Triangle' },
  redcircle: { kind: 'enemy', role: 'Dwight the Black Hole' },
  whiteplayer: { kind: 'player', role: 'Player ship' },
  yellowshot: { kind: 'projectile', role: 'Player shot' },
  whitestar: { kind: 'ui_fx', role: 'Powerup aura / pickup star' },
  snaketail: { kind: 'enemy', role: 'Selena the Snake tail animation' },
  snakehead: { kind: 'enemy', role: 'Selena the Snake head' },
  powerups: { kind: 'powerup_atlas', role: 'Powerup atlas' },
  icons: { kind: 'ui_atlas', role: 'Icon atlas' },
  particle: { kind: 'fx', role: 'Particle sprite' },
  colourpick: { kind: 'ui_atlas', role: 'Grid color picker strip' },
};

const POWERUP_FRAME_MAP = [
  { frame: 0, role: 'Extra front shooter' },
  { frame: 2, role: 'Back shooter' },
  { frame: 3, role: 'Side shooters' },
  { frame: 5, role: 'Shot speed' },
  { frame: 6, role: 'Extra life' },
  { frame: 7, role: 'Super shots' },
  { frame: 8, role: 'Extra bomb' },
  { frame: 9, role: 'Shield' },
  { frame: 10, role: 'Bouncy shots' },
];

const SOUND_ROLE_MAP = {
  'buzz3.wav': { id: 'nme_born_snd', category: 'enemy_spawn', role: 'Generic enemy born' },
  'pop2.wav': { id: 'nme1_born_snd', category: 'enemy_spawn', role: 'Pinwheel born' },
  'pop3.wav': { id: 'nme2_born_snd', category: 'enemy_spawn', role: 'Diamond born' },
  'snake1.wav': { id: 'nme3_born_snd', category: 'enemy_spawn', role: 'Snake born' },
  'gruntborn.wav': { id: 'nme4_born_snd', category: 'enemy_spawn', role: 'Square born' },
  'sun1.wav': { id: 'nme5_born_snd', category: 'enemy_spawn', role: 'Black hole born' },
  'bondloop.wav': { id: 'nme5_loop_snd', category: 'enemy_loop', role: 'Black hole loop' },
  'sunhit1.wav': { id: 'nme5_shrink_snd', category: 'enemy_hit', role: 'Black hole shrink' },
  'sizzle1.wav': { id: 'nme5_grow_snd', category: 'enemy_hit', role: 'Black hole grow' },
  'sunexp.wav': { id: 'nme5_explode_snd', category: 'enemy_death', role: 'Black hole overload explosion' },
  'Explo1.wav': { id: 'nme5_killed_snd/super_bomb_snd', category: 'enemy_death', role: 'Black hole killed / super bomb' },
  'wee.wav': { id: 'nme6_born_snd', category: 'enemy_spawn', role: 'Snake child born' },
  'snakehit.wav': { id: 'nme6_tailexplode_snd', category: 'enemy_hit', role: 'Snake tail explode' },
  'tailhit.wav': { id: 'nme6_tailhit_snd', category: 'enemy_hit', role: 'Snake tail hit' },
  'warn1.wav': { id: 'nme7_born_snd', category: 'enemy_spawn', role: 'Shielded/warning enemy born' },
  'shield1.wav': { id: 'nme7_shield_snd', category: 'enemy_state', role: 'Shield active' },
  'butterfly.wav': { id: 'nme8_born_snd', category: 'enemy_spawn', role: 'Butterfly born' },
  'cat.wav': { id: 'ge_born_snd', category: 'enemy_spawn', role: 'Generator born' },
  'genhit1.wav': { id: 'ge_hit_snd', category: 'enemy_hit', role: 'Generator hit' },
  'genkilled1.wav': { id: 'ge_killed_snd', category: 'enemy_death', role: 'Generator killed' },
  'buzz1.wav': { id: 'le_born_snd', category: 'enemy_spawn', role: 'Lateral/interceptor enemy born' },
  'echo1.wav': { id: 'le_hit_snd', category: 'enemy_hit', role: 'Lateral/interceptor hit' },
  'elastic.wav': { id: 'le_killed_snd', category: 'enemy_death', role: 'Lateral/interceptor killed' },
  'bonus1.wav': { id: 'pu_collect_snd/high_score_snd', category: 'powerup', role: 'Powerup collect / high score reuse' },
  'startup.wav': { id: 'get_ready_snd', category: 'ui', role: 'Get ready / startup' },
  'die1.wav': { id: 'player_hit_snd', category: 'player', role: 'Player hit / lose life' },
  'shotborn.wav': { id: 'shot_born_snd', category: 'player', role: 'Shot fired' },
  'shotwall.wav': { id: 'shot_hit_wall_snd', category: 'player', role: 'Shot hit wall' },
  'gameover.wav': { id: 'game_over_snd', category: 'ui', role: 'Game over' },
  'brainborn.wav': { id: 'extra_life_snd', category: 'powerup', role: 'Extra life awarded' },
  'buzz2.wav': { id: 'extra_bomb_snd', category: 'powerup', role: 'Extra bomb awarded' },
  'bonus2.wav': { id: 'multiplier_increase_snd', category: 'powerup', role: 'Multiplier increase' },
  'bonusborn.wav': { id: 'bonus_born_snd', category: 'powerup', role: 'Bonus born' },
  'quarkhit.wav': { id: 'quarkhitsound', category: 'enemy_hit', role: 'Quark hit' },
  'quarkhit2.wav': { id: 'quarkhit2sound', category: 'enemy_hit', role: 'Quark hit variant' },
  'click.wav': { id: null, category: 'unused', role: 'Present in archive but not loaded by sound.bmx' },
  'pop1.wav': { id: null, category: 'unused', role: 'Present in archive but not loaded by sound.bmx' },
};

const MUSIC_ROLE_MAP = {
  'Theme0.it': 'intro',
  'Theme1.it': 'in_game',
  'Theme1.it-old': 'alternate_in_game_revision',
  'Theme2.it': 'hiscore',
};

const ACTIVE_GRIDWARS_ENEMIES = [
  'Paul the Pinwheel',
  'Dimmy the Diamond',
  'Shy the Square',
  'Cubie the Cube',
  'Sammy the Seeker',
  'Dwight the Black Hole',
  'Selena the Snake',
  'Ivan the Interceptor',
  'Trish the Triangle',
  'Indy the Butterfly',
];

function decodeLatin1(buf, start, length) {
  const raw = buf.toString('latin1', start, start + length);
  const zero = raw.indexOf('\0');
  return (zero >= 0 ? raw.slice(0, zero) : raw).replace(/\r/g, '').trim();
}

function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

function readUInt16LE(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf, offset) {
  return buf.readUInt32LE(offset);
}

function decodeNote(note) {
  if (note === undefined || note === null) return null;
  if (note === 0) return null;
  if (note >= 1 && note <= 120) {
    const names = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
    const n = note - 1;
    return `${names[n % 12]}${Math.floor(n / 12)}`;
  }
  if (note === 254) return 'NOTE_CUT';
  if (note === 255) return 'NOTE_OFF';
  if (note === 246) return 'NOTE_FADE';
  return `SPECIAL_${note}`;
}

function decodeEffect(command) {
  if (!command) return null;
  if (command >= 1 && command <= 26) return String.fromCharCode(64 + command);
  return `CMD_${command}`;
}

function parsePng(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Not a PNG');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function parseWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV');
  }

  let offset = 12;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let dataBytes = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (chunkId === 'fmt ') {
      channels = buffer.readUInt16LE(dataStart + 2);
      sampleRate = buffer.readUInt32LE(dataStart + 4);
      bitsPerSample = buffer.readUInt16LE(dataStart + 14);
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    }
    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  const bytesPerSample = channels && bitsPerSample ? channels * (bitsPerSample / 8) : null;
  const durationSeconds = sampleRate && dataBytes && bytesPerSample
    ? Number((dataBytes / (sampleRate * bytesPerSample)).toFixed(4))
    : null;

  return { channels, sampleRate, bitsPerSample, dataBytes, durationSeconds };
}

function parseItSampleHeader(buffer, offset) {
  if (buffer.toString('ascii', offset, offset + 4) !== 'IMPS') {
    throw new Error(`Invalid sample header at 0x${offset.toString(16)}`);
  }

  const flags = buffer[offset + 18];
  return {
    filename: decodeLatin1(buffer, offset + 4, 12),
    globalVolume: buffer[offset + 17],
    flags,
    defaultVolume: buffer[offset + 19],
    name: decodeLatin1(buffer, offset + 20, 26),
    defaultPan: buffer[offset + 47],
    length: readUInt32LE(buffer, offset + 48),
    loopBegin: readUInt32LE(buffer, offset + 52),
    loopEnd: readUInt32LE(buffer, offset + 56),
    c5Speed: readUInt32LE(buffer, offset + 60),
    sustainLoopBegin: readUInt32LE(buffer, offset + 64),
    sustainLoopEnd: readUInt32LE(buffer, offset + 68),
    samplePointer: readUInt32LE(buffer, offset + 72),
    vibratoSpeed: buffer[offset + 76],
    vibratoDepth: buffer[offset + 77],
    vibratoRate: buffer[offset + 78],
    vibratoType: buffer[offset + 79],
    flagSummary: {
      hasSampleData: Boolean(flags & 1),
      is16Bit: Boolean(flags & 2),
      isStereo: Boolean(flags & 4),
      isCompressed: Boolean(flags & 8),
      looped: Boolean(flags & 16),
      sustainLoop: Boolean(flags & 32),
      bidiLoop: Boolean(flags & 64),
      bidiSustain: Boolean(flags & 128),
    },
  };
}

function parseItPattern(buffer, offset) {
  if (!offset) {
    return {
      packedLength: 0,
      rowCount: 64,
      eventCount: 0,
      channelsUsed: [],
      noteHistogram: {},
      rows: [],
    };
  }

  const packedLength = readUInt16LE(buffer, offset);
  const rowCount = readUInt16LE(buffer, offset + 2);
  const data = buffer.subarray(offset + 8, offset + 8 + packedLength);

  const lastMask = new Uint8Array(64);
  const lastNote = new Array(64).fill(null);
  const lastInstrument = new Array(64).fill(null);
  const lastVolume = new Array(64).fill(null);
  const lastEffect = new Array(64).fill(null);

  const rows = [];
  const channelsUsed = new Set();
  const noteHistogram = new Map();

  let pos = 0;
  let rowIndex = 0;
  while (rowIndex < rowCount && pos < data.length) {
    const events = [];
    while (pos < data.length) {
      const channelByte = data[pos++];
      if (channelByte === 0) break;

      const channel = (channelByte - 1) & 63;
      channelsUsed.add(channel);

      let mask = lastMask[channel];
      if (channelByte & 0x80) {
        mask = data[pos++];
        lastMask[channel] = mask;
      }

      const event = { channel };

      if (mask & 0x01) {
        const note = data[pos++];
        lastNote[channel] = note;
        event.note = decodeNote(note);
        if (event.note) {
          noteHistogram.set(event.note, (noteHistogram.get(event.note) ?? 0) + 1);
        }
      }
      if (mask & 0x02) {
        const instrument = data[pos++];
        lastInstrument[channel] = instrument;
        event.instrument = instrument;
      }
      if (mask & 0x04) {
        const volume = data[pos++];
        lastVolume[channel] = volume;
        event.volume = volume;
      }
      if (mask & 0x08) {
        const effectCommand = data[pos++];
        const effectParam = data[pos++];
        lastEffect[channel] = { effectCommand, effectParam };
        event.effect = decodeEffect(effectCommand);
        event.effectCommand = effectCommand;
        event.effectParam = effectParam;
      }
      if (mask & 0x10) {
        const note = lastNote[channel];
        event.note = decodeNote(note);
        if (event.note) {
          noteHistogram.set(event.note, (noteHistogram.get(event.note) ?? 0) + 1);
        }
      }
      if (mask & 0x20) event.instrument = lastInstrument[channel];
      if (mask & 0x40) event.volume = lastVolume[channel];
      if (mask & 0x80 && lastEffect[channel]) {
        event.effect = decodeEffect(lastEffect[channel].effectCommand);
        event.effectCommand = lastEffect[channel].effectCommand;
        event.effectParam = lastEffect[channel].effectParam;
      }

      events.push(event);
    }

    rows.push({ row: rowIndex, events });
    rowIndex += 1;
  }

  return {
    packedLength,
    rowCount,
    eventCount: rows.reduce((sum, row) => sum + row.events.length, 0),
    channelsUsed: [...channelsUsed].sort((a, b) => a - b),
    noteHistogram: Object.fromEntries([...noteHistogram.entries()].sort()),
    rows,
  };
}

function parseItModule(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'IMPM') {
    throw new Error('Not an IT module');
  }

  const header = {
    songName: decodeLatin1(buffer, 4, 26),
    highlightMinor: buffer[0x1e],
    highlightMajor: buffer[0x1f],
    ordNum: readUInt16LE(buffer, 0x20),
    insNum: readUInt16LE(buffer, 0x22),
    smpNum: readUInt16LE(buffer, 0x24),
    patNum: readUInt16LE(buffer, 0x26),
    createdWithTrackerVersion: readUInt16LE(buffer, 0x28),
    compatibleWithVersion: readUInt16LE(buffer, 0x2a),
    flags: readUInt16LE(buffer, 0x2c),
    special: readUInt16LE(buffer, 0x2e),
    globalVolume: buffer[0x30],
    mixVolume: buffer[0x31],
    initialSpeed: buffer[0x32],
    initialTempo: buffer[0x33],
    panSeparation: buffer[0x34],
    pitchWheelDepth: buffer[0x35],
    messageLength: readUInt16LE(buffer, 0x36),
    messageOffset: readUInt32LE(buffer, 0x38),
  };

  let tableOffset = 0xc0;
  const orders = [...buffer.subarray(tableOffset, tableOffset + header.ordNum)];
  tableOffset += header.ordNum;

  const instrumentOffsets = [];
  for (let i = 0; i < header.insNum; i++) {
    instrumentOffsets.push(readUInt32LE(buffer, tableOffset + i * 4));
  }
  tableOffset += header.insNum * 4;

  const sampleOffsets = [];
  for (let i = 0; i < header.smpNum; i++) {
    sampleOffsets.push(readUInt32LE(buffer, tableOffset + i * 4));
  }
  tableOffset += header.smpNum * 4;

  const patternOffsets = [];
  for (let i = 0; i < header.patNum; i++) {
    patternOffsets.push(readUInt32LE(buffer, tableOffset + i * 4));
  }

  const message = header.messageLength > 0
    ? decodeLatin1(buffer, header.messageOffset, header.messageLength)
    : '';

  const samples = sampleOffsets.map((offset, index) => ({
    index,
    offset,
    ...parseItSampleHeader(buffer, offset),
  }));

  const patterns = patternOffsets.map((offset, index) => ({
    index,
    offset,
    ...parseItPattern(buffer, offset),
  }));

  return { header, orders, instrumentOffsets, sampleOffsets, patternOffsets, message, samples, patterns };
}

async function getPngInfo(filePath) {
  const buffer = await fs.readFile(filePath);
  return parsePng(buffer);
}

async function getWavInfo(filePath) {
  const buffer = await fs.readFile(filePath);
  return parseWav(buffer);
}

async function getItInfo(filePath) {
  const buffer = await fs.readFile(filePath);
  return parseItModule(buffer);
}

async function buildGfxManifest() {
  const gfxRoot = path.join(gridWarsRoot, 'gfx');
  const sets = ['solid', 'low', 'med', 'high', 'user'];
  const manifest = {};

  for (const setName of sets) {
    const setDir = path.join(gfxRoot, setName);
    const entries = await fs.readdir(setDir);
    const images = [];
    for (const entry of entries) {
      if (!entry.match(/\.png$/i)) continue;
      const baseName = entry.replace(/\.[^.]+$/, '');
      const info = await getPngInfo(path.join(setDir, entry));
      images.push({
        file: entry,
        baseName,
        ...info,
        ...IMAGE_ROLE_MAP[baseName],
      });
    }
    images.sort((a, b) => a.baseName.localeCompare(b.baseName));
    manifest[setName] = images;
  }

  const colourpick = await getPngInfo(path.join(gfxRoot, 'colourpick.PNG'));

  return {
    sets: manifest,
    sharedAtlases: {
      colourpick: {
        file: 'gfx/colourpick.PNG',
        ...colourpick,
        frameWidth: 122,
        frameHeight: 9,
        frameCount: 3,
        role: 'Grid color picker strip',
      },
      powerups: {
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 11,
        frameRoles: POWERUP_FRAME_MAP,
      },
      icons: {
        frameCount: 2,
      },
      snaketail: {
        frameCount: 24,
      },
    },
  };
}

async function buildSoundManifest() {
  const soundDir = path.join(gridWarsRoot, 'sounds');
  const entries = (await fs.readdir(soundDir)).filter((entry) => entry.match(/\.wav$/i)).sort((a, b) => a.localeCompare(b));

  const files = [];
  for (const entry of entries) {
    const info = await getWavInfo(path.join(soundDir, entry));
    const role = SOUND_ROLE_MAP[entry] ?? SOUND_ROLE_MAP[entry.toLowerCase()] ?? null;
    files.push({
      file: entry,
      ...info,
      mapping: role,
    });
  }

  const missingReferences = ['shieldwarning.wav'].filter(async () => false);
  void missingReferences;

  return {
    files,
    missingReferences: ['shieldwarning.wav'],
    unusedArchiveFiles: files.filter((file) => file.mapping?.category === 'unused').map((file) => file.file),
    summaryByCategory: files.reduce((acc, file) => {
      const key = file.mapping?.category ?? 'unmapped';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

async function buildMusicManifest() {
  const musicDir = path.join(gridWarsRoot, 'music');
  const entries = (await fs.readdir(musicDir)).filter((entry) => entry.match(/\.it(?:-old)?$/i)).sort((a, b) => a.localeCompare(b));

  const modules = [];
  for (const entry of entries) {
    const parsed = await getItInfo(path.join(musicDir, entry));
    modules.push({
      file: entry,
      role: MUSIC_ROLE_MAP[entry] ?? null,
      ...parsed,
    });
  }

  return {
    modules,
    missingMacOggFallbacks: ['Theme0.ogg', 'Theme1.ogg', 'Theme2.ogg'],
  };
}

function buildAssetSummary(assetManifest, soundManifest, musicManifest) {
  return {
    generatedAt: new Date().toISOString(),
    bundle: 'GridWars54',
    activeEnemyRoster: ACTIVE_GRIDWARS_ENEMIES,
    gfxSetNames: Object.keys(assetManifest.sets),
    gfxFileCount: Object.values(assetManifest.sets).reduce((sum, images) => sum + images.length, 0) + 1,
    wavFileCount: soundManifest.files.length,
    musicModuleCount: musicManifest.modules.length,
    notes: [
      'Windows build loads IT tracker modules directly via BASS.',
      'Mac OGG fallback paths are referenced in source but not present in the archive.',
      'shieldwarning.wav is referenced by sound.bmx but missing from docs/GridWars54/sounds.',
    ],
  };
}

async function main() {
  await ensureDir(outDir);

  const assetManifest = await buildGfxManifest();
  const soundManifest = await buildSoundManifest();
  const musicManifest = await buildMusicManifest();
  const summary = buildAssetSummary(assetManifest, soundManifest, musicManifest);

  await fs.writeFile(
    path.join(outDir, 'gridwars54-asset-manifest.json'),
    JSON.stringify({ summary, gfx: assetManifest, audio: soundManifest }, null, 2) + '\n',
    'utf8',
  );

  await fs.writeFile(
    path.join(outDir, 'gridwars54-music-manifest.json'),
    JSON.stringify(musicManifest, null, 2) + '\n',
    'utf8',
  );

  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, 'gridwars54-asset-manifest.json'))}`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, 'gridwars54-music-manifest.json'))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
