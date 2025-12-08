#!/usr/bin/env node
/**
 * Smart Mode Test Script
 * Tests the focus detection feature by:
 * 1. Running the focus-checker binary directly
 * 2. Simulating what would happen with different focus states
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const focusCheckerPath = join(__dirname, 'bin', 'focus-checker');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function checkFocus() {
  if (!existsSync(focusCheckerPath)) {
    return { error: 'not_found', message: 'focus-checker binary not found' };
  }

  try {
    const result = execSync(focusCheckerPath, {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (e) {
    // Try to parse output even on error
    try {
      const output = e.stdout?.toString() || e.stderr?.toString() || '';
      if (output) {
        return JSON.parse(output);
      }
    } catch (parseErr) {
      // ignore
    }
    return { error: 'exec_failed', message: e.message };
  }
}

function printFocusResult(focus) {
  if (focus.error) {
    if (focus.error === 'accessibility_not_granted') {
      log(colors.yellow, '⚠️  Accessibility permission not granted');
      log(colors.dim, '   Grant permission in System Settings > Privacy & Security > Accessibility');
      if (focus.appName) {
        log(colors.dim, `   Detected app: ${focus.appName} (${focus.appBundleId || 'no bundle ID'})`);
      }
    } else {
      log(colors.red, `❌ Error: ${focus.error} - ${focus.message || ''}`);
    }
    return;
  }

  const isText = focus.isTextInput;
  const icon = isText ? '✅' : '❌';
  const status = isText ? 'IS text input' : 'NOT text input';

  log(colors.cyan, `${icon} ${status}`);
  log(colors.dim, `   App: ${focus.appName || 'unknown'}`);
  log(colors.dim, `   Role: ${focus.role || 'none'}`);
  log(colors.dim, `   Subrole: ${focus.subrole || 'none'}`);
  log(colors.dim, `   Editable: ${focus.isEditable || false}`);
  log(colors.dim, `   Has text range: ${focus.hasSelectedTextRange || false}`);
  if (focus.debug) {
    log(colors.dim, `   Debug: ${focus.debug}`);
  }
}

function simulateTranscript(text, isTextInput) {
  log(colors.cyan, `\n📝 Simulating transcript: "${text}"`);
  log(colors.dim, `   Focus state: ${isTextInput ? 'IN text field' : 'NOT in text field'}`);

  const lowerText = text.toLowerCase().trim();

  // Check if it's a command
  const isCommand = lowerText.startsWith('computer ') ||
                    lowerText === 'affirmative' ||
                    lowerText === 'retract';

  if (isTextInput) {
    // In text field - everything works
    if (isCommand) {
      log(colors.green, `   → Would execute command: ${lowerText}`);
    } else {
      log(colors.green, `   → Would type text: "${text}"`);
    }
  } else {
    // Not in text field - commands only
    if (isCommand) {
      log(colors.green, `   → Would execute command: ${lowerText}`);
    } else {
      log(colors.yellow, `   → Would IGNORE (not a command, not in text field)`);
    }
  }
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n=== Interactive Smart Mode Test ===');
  console.log('Commands:');
  console.log('  focus     - Check current focus state');
  console.log('  monitor   - Continuously monitor focus (5 sec)');
  console.log('  sim TEXT  - Simulate transcript with current focus');
  console.log('  simtext TEXT - Simulate transcript assuming IN text field');
  console.log('  simno TEXT   - Simulate transcript assuming NOT in text field');
  console.log('  quit      - Exit\n');

  const prompt = () => {
    rl.question('> ', (input) => {
      const parts = input.trim().split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      switch (cmd) {
        case 'focus':
          const focus = checkFocus();
          printFocusResult(focus);
          break;

        case 'monitor':
          console.log('Monitoring focus for 5 seconds... Click around!');
          let lastState = null;
          const interval = setInterval(() => {
            const f = checkFocus();
            const stateKey = `${f.isTextInput}-${f.role}-${f.appName}`;
            if (stateKey !== lastState) {
              printFocusResult(f);
              lastState = stateKey;
            }
          }, 200);
          setTimeout(() => {
            clearInterval(interval);
            console.log('Monitoring complete.');
            prompt();
          }, 5000);
          return;

        case 'sim':
          if (!args) {
            console.log('Usage: sim TEXT');
          } else {
            const focus = checkFocus();
            const isTextInput = focus.isTextInput === true;
            simulateTranscript(args, isTextInput);
          }
          break;

        case 'simtext':
          if (!args) {
            console.log('Usage: simtext TEXT');
          } else {
            simulateTranscript(args, true);
          }
          break;

        case 'simno':
          if (!args) {
            console.log('Usage: simno TEXT');
          } else {
            simulateTranscript(args, false);
          }
          break;

        case 'quit':
        case 'exit':
        case 'q':
          rl.close();
          process.exit(0);
          return;

        default:
          if (input.trim()) {
            console.log('Unknown command. Type "focus", "monitor", "sim TEXT", or "quit"');
          }
      }

      prompt();
    });
  };

  prompt();
}

async function main() {
  console.log('=== Smart Mode Focus Detection Test ===\n');
  console.log(`Focus checker: ${focusCheckerPath}`);
  console.log(`Exists: ${existsSync(focusCheckerPath)}\n`);

  // Initial focus check
  console.log('--- Current Focus State ---');
  const focus = checkFocus();
  printFocusResult(focus);

  // Show what would happen with sample transcripts
  console.log('\n--- Sample Transcript Simulations ---');

  const isTextInput = focus.isTextInput === true && !focus.error;

  // Test various transcripts
  const samples = [
    'Hello world',              // Regular text
    'computer enter',           // Command
    'affirmative',              // Special command without "computer"
    'retract',                  // Undo command
    'computer smart mode on',   // Smart mode command
    'This is a longer sentence that would be typed normally.',
  ];

  for (const text of samples) {
    simulateTranscript(text, isTextInput);
  }

  // Start interactive mode
  await interactiveMode();
}

main().catch(console.error);
