#!/usr/bin/env npx tsx
/**
 * Maestro-style declarative test runner.
 * Reads YAML flow files and executes them against a running Vite preview server
 * using Playwright (headless Chromium).
 *
 * Usage:
 *   npx tsx tests/run-flow.ts <flow-file|all> [--tag <tag>] [--base-url <url>]
 */

import { chromium, type Browser, type Page } from 'playwright';
import { parse as parseYAML } from 'yaml';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface FlowStep {
  action: string;
  [key: string]: unknown;
}

interface Flow {
  name: string;
  tags?: string[];
  steps: FlowStep[];
}

interface StepResult {
  action: string;
  description?: string;
  pass: boolean;
  error?: string;
  durationMs: number;
}

interface FlowResult {
  name: string;
  file: string;
  pass: boolean;
  steps: StepResult[];
  durationMs: number;
}

// ── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let flowTarget = args[0] || 'all';
let tagFilter: string | null = null;
let baseUrl = 'http://localhost:4173';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tag' && args[i + 1]) tagFilter = args[++i];
  if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
}

const FLOWS_DIR = join(__dirname, 'flows');
const SCREENSHOTS_DIR = join(__dirname, 'screenshots');

// ── Flow Loading ───────────────────────────────────────────────────────────

function loadFlows(): { flow: Flow; file: string }[] {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  let files: string[];
  if (flowTarget === 'all') {
    if (!existsSync(FLOWS_DIR)) {
      console.error(`No flows directory found at ${FLOWS_DIR}`);
      process.exit(1);
    }
    files = readdirSync(FLOWS_DIR)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => join(FLOWS_DIR, f))
      .sort();
  } else if (existsSync(flowTarget)) {
    files = [flowTarget];
  } else {
    // Treat as tag filter
    tagFilter = flowTarget;
    files = readdirSync(FLOWS_DIR)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => join(FLOWS_DIR, f))
      .sort();
  }

  const flows: { flow: Flow; file: string }[] = [];
  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const flow = parseYAML(raw) as Flow;
    if (tagFilter && flow.tags && !flow.tags.includes(tagFilter)) continue;
    flows.push({ flow, file });
  }
  return flows;
}

/** Wrap a script that uses `return` into an IIFE so page.evaluate accepts it */
function wrapScript(script: string): string {
  return `(() => { ${script} })()`;
}

// ── Step Executors ─────────────────────────────────────────────────────────

async function executeStep(page: Page, step: FlowStep, flowName: string): Promise<StepResult> {
  const start = Date.now();
  const result: StepResult = {
    action: step.action,
    description: (step.description as string) || undefined,
    pass: false,
    durationMs: 0,
  };

  try {
    switch (step.action) {
      case 'launch': {
        const url = (step.url as string) || '/';
        await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
        if (step.waitFor) {
          await page.waitForSelector(step.waitFor as string, { timeout: 10000 });
        }
        result.pass = true;
        break;
      }

      case 'screenshot': {
        const name = (step.name as string) || `${flowName}-${Date.now()}`;
        const path = join(SCREENSHOTS_DIR, `${name}.png`);
        await page.screenshot({ path });
        result.pass = true;
        result.description = `Saved: ${basename(path)}`;
        break;
      }

      case 'wait': {
        const ms = (step.ms as number) || 1000;
        await page.waitForTimeout(ms);
        result.pass = true;
        break;
      }

      case 'click': {
        if (step.selector) {
          const el = await page.waitForSelector(step.selector as string, { timeout: 5000 });
          if (el) {
            if (step.x !== undefined && step.y !== undefined) {
              const box = await el.boundingBox();
              if (box) {
                await page.mouse.click(
                  box.x + box.width * (step.x as number),
                  box.y + box.height * (step.y as number),
                );
              }
            } else {
              await el.click();
            }
          }
        } else if (step.x !== undefined && step.y !== undefined) {
          await page.mouse.click(step.x as number, step.y as number);
        }
        result.pass = true;
        break;
      }

      case 'assertVisible': {
        const el = await page.waitForSelector(step.selector as string, { timeout: 5000 });
        result.pass = !!el && await el.isVisible();
        if (!result.pass) result.error = `Element not visible: ${step.selector}`;
        break;
      }

      case 'assertHidden': {
        const hidden = await page.locator(step.selector as string).isHidden();
        result.pass = hidden;
        if (!result.pass) result.error = `Element not hidden: ${step.selector}`;
        break;
      }

      case 'evalCheck':
      case 'assertEval': {
        const val = await page.evaluate(wrapScript(step.script as string));
        result.pass = !!val;
        if (!result.pass) result.error = `Eval returned falsy: ${step.description || step.script}`;
        break;
      }

      case 'waitForEval': {
        const timeout = (step.timeout as number) || 10000;
        const pollInterval = 200;
        const deadline = Date.now() + timeout;
        let lastVal: unknown = false;
        while (Date.now() < deadline) {
          lastVal = await page.evaluate(wrapScript(step.script as string));
          if (lastVal) { result.pass = true; break; }
          await page.waitForTimeout(pollInterval);
        }
        if (!result.pass) result.error = `Timed out waiting: ${step.description || ''}`;
        break;
      }

      case 'keyPress': {
        const key = step.key as string;
        const duration = (step.duration as number) || 100;
        await page.keyboard.down(key);
        await page.waitForTimeout(duration);
        await page.keyboard.up(key);
        result.pass = true;
        break;
      }

      case 'keys': {
        const keys = step.keys as string[];
        const duration = (step.duration as number) || 100;
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(duration);
        for (const k of keys) await page.keyboard.up(k);
        result.pass = true;
        break;
      }

      case 'mouseMove': {
        await page.mouse.move(step.x as number, step.y as number);
        result.pass = true;
        break;
      }

      case 'mouseDown': {
        await page.mouse.down();
        result.pass = true;
        break;
      }

      case 'mouseUp': {
        await page.mouse.up();
        result.pass = true;
        break;
      }

      case 'assertNoErrors': {
        // Collect console errors during flow (set up in flow runner)
        result.pass = true; // checked at flow level
        break;
      }

      default:
        result.error = `Unknown action: ${step.action}`;
    }
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  result.durationMs = Date.now() - start;
  return result;
}

// ── Flow Runner ────────────────────────────────────────────────────────────

async function runFlow(browser: Browser, flow: Flow, file: string): Promise<FlowResult> {
  const start = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    // Ignore WebGL warnings in headless
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known harmless errors
      if (text.includes('favicon.ico') || text.includes('404')) return;
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  const results: StepResult[] = [];
  let allPass = true;

  for (const step of flow.steps) {
    const stepResult = await executeStep(page, step, flow.name.replace(/\s+/g, '-'));

    // Special handling for assertNoErrors
    if (step.action === 'assertNoErrors') {
      if (consoleErrors.length > 0) {
        stepResult.pass = false;
        stepResult.error = `Console errors: ${consoleErrors.join('; ')}`;
      }
    }

    results.push(stepResult);
    if (!stepResult.pass) {
      allPass = false;
      // Take failure screenshot
      try {
        await page.screenshot({
          path: join(SCREENSHOTS_DIR, `FAIL-${flow.name.replace(/\s+/g, '-')}-${results.length}.png`),
        });
      } catch { /* ignore */ }
      break; // Stop flow on first failure
    }
  }

  await context.close();

  return {
    name: flow.name,
    file: basename(file),
    pass: allPass,
    steps: results,
    durationMs: Date.now() - start,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const flows = loadFlows();
  if (flows.length === 0) {
    console.log('No matching flows found.');
    process.exit(0);
  }

  console.log(`\n  MAESTRO  Running ${flows.length} flow(s)${tagFilter ? ` [tag: ${tagFilter}]` : ''}\n`);

  const headed = !!process.env.HEADED;

  const browser = await chromium.launch({
    headless: !headed,
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--use-gl=swiftshader',
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
    ],
  });

  const results: FlowResult[] = [];

  for (const { flow, file } of flows) {
    process.stdout.write(`  ${flow.name} `);
    const result = await runFlow(browser, flow, file);
    results.push(result);

    if (result.pass) {
      console.log(`\x1b[32mPASS\x1b[0m  (${result.durationMs}ms)`);
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m  (${result.durationMs}ms)`);
      for (const s of result.steps) {
        const icon = s.pass ? '\x1b[32m+\x1b[0m' : '\x1b[31m✗\x1b[0m';
        const desc = s.description || s.action;
        console.log(`    ${icon} ${desc}${s.error ? ` — ${s.error}` : ''} (${s.durationMs}ms)`);
      }
    }
  }

  await browser.close();

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;
  const totalTime = results.reduce((s, r) => s + r.durationMs, 0);

  console.log(`\n  ────────────────────────────────────────`);
  console.log(`  ${passed}/${total} passed, ${failed} failed  (${totalTime}ms total)`);

  if (failed > 0) {
    console.log(`  Screenshots saved to tests/screenshots/`);
    console.log('');
    process.exit(1);
  }
  console.log('');
}

main().catch(err => {
  console.error('Maestro runner error:', err);
  process.exit(1);
});
