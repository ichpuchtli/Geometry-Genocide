#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = 'https://api.elevenlabs.io/v1/sound-generation';

function printUsage() {
  console.log(`Usage:
  ELEVENLABS_API_KEY=... node scripts/generate-elevenlabs-sfx.mjs --text "prompt" --out sounds/generated/foo.mp3 [options]
  ELEVENLABS_API_KEY=... node scripts/generate-elevenlabs-sfx.mjs --manifest scripts/elevenlabs-sfx-jobs.example.json [options]

Options:
  --text <prompt>                 Prompt for a single generation
  --out <path>                    Output path for a single generation
  --manifest <path>               JSON file containing an array of jobs
  --duration <seconds>            Duration for single generation (0.5 - 30)
  --prompt-influence <0-1>        Higher = stricter adherence to prompt
  --loop                          Request a seamless loop
  --model <model_id>              Defaults to eleven_text_to_sound_v2
  --format <output_format>        Defaults to mp3_44100_128
  --dry-run                       Print resolved jobs without calling ElevenLabs
  --help                          Show this message

Manifest shape:
  [
    {
      "text": "Glassy crystal impact, neon arcade enemy death",
      "out": "sounds/generated/rhombus_kill_v1.mp3",
      "duration": 0.8,
      "promptInfluence": 0.45,
      "loop": false
    }
  ]
`);
}

function parseArgs(argv) {
  const args = {
    text: null,
    out: null,
    manifest: null,
    duration: null,
    promptInfluence: null,
    loop: false,
    model: 'eleven_text_to_sound_v2',
    format: 'mp3_44100_128',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--text':
        args.text = argv[++i] ?? null;
        break;
      case '--out':
        args.out = argv[++i] ?? null;
        break;
      case '--manifest':
        args.manifest = argv[++i] ?? null;
        break;
      case '--duration':
        args.duration = argv[++i] ?? null;
        break;
      case '--prompt-influence':
        args.promptInfluence = argv[++i] ?? null;
        break;
      case '--loop':
        args.loop = true;
        break;
      case '--model':
        args.model = argv[++i] ?? args.model;
        break;
      case '--format':
        args.format = argv[++i] ?? args.format;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function toNumber(value, name) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`${name} must be a number`);
  return num;
}

function validateJob(job, index) {
  if (!job.text || typeof job.text !== 'string') {
    throw new Error(`Job ${index} is missing a valid "text" prompt`);
  }
  if (!job.out || typeof job.out !== 'string') {
    throw new Error(`Job ${index} is missing a valid "out" path`);
  }
  if (job.duration != null && (job.duration < 0.5 || job.duration > 30)) {
    throw new Error(`Job ${index} duration must be between 0.5 and 30 seconds`);
  }
  if (job.promptInfluence != null && (job.promptInfluence < 0 || job.promptInfluence > 1)) {
    throw new Error(`Job ${index} promptInfluence must be between 0 and 1`);
  }
}

async function loadJobs(args) {
  if (args.manifest) {
    const manifestPath = path.resolve(args.manifest);
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Manifest must be a JSON array');
    }
    return parsed.map((job, index) => {
      const normalized = {
        text: job.text,
        out: job.out,
        duration: job.duration ?? null,
        promptInfluence: job.promptInfluence ?? null,
        loop: Boolean(job.loop),
        model: job.model ?? args.model,
        format: job.format ?? args.format,
      };
      validateJob(normalized, index);
      return normalized;
    });
  }

  if (!args.text || !args.out) {
    throw new Error('Single-generation mode requires both --text and --out');
  }

  const singleJob = {
    text: args.text,
    out: args.out,
    duration: toNumber(args.duration, 'duration'),
    promptInfluence: toNumber(args.promptInfluence, 'prompt influence'),
    loop: args.loop,
    model: args.model,
    format: args.format,
  };
  validateJob(singleJob, 0);
  return [singleJob];
}

async function generateJob(apiKey, job, index, total) {
  const outputPath = path.resolve(job.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const url = new URL(API_URL);
  if (job.format) url.searchParams.set('output_format', job.format);

  const body = {
    text: job.text,
    model_id: job.model,
    loop: job.loop,
  };
  if (job.duration != null) body.duration_seconds = job.duration;
  if (job.promptInfluence != null) body.prompt_influence = job.promptInfluence;

  console.log(`[${index + 1}/${total}] Generating ${job.out}`);
  console.log(`Prompt: ${job.text}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs request failed for ${job.out}: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Saved ${outputPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = await loadJobs(args);

  if (args.dryRun) {
    console.log(JSON.stringify(jobs, null, 2));
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is required');
  }

  for (let i = 0; i < jobs.length; i++) {
    await generateJob(apiKey, jobs[i], i, jobs.length);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
