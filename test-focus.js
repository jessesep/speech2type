#!/usr/bin/env node
/**
 * Test script for focus detection
 * Simulates the focus checking logic without needing Deepgram
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const focusCheckerPath = join(__dirname, 'bin', 'focus-checker');

console.log('=== Focus Detection Test ===\n');
console.log(`Focus checker path: ${focusCheckerPath}`);
console.log(`Exists: ${existsSync(focusCheckerPath)}\n`);

function checkFocus() {
  try {
    const result = execSync(focusCheckerPath, {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (e) {
    console.error('Error:', e.message);
    return null;
  }
}

// Test 1: Check current focus
console.log('--- Test 1: Current Focus State ---');
const focus1 = checkFocus();
if (focus1) {
  console.log('Result:', JSON.stringify(focus1, null, 2));
  console.log(`\nIs Text Input: ${focus1.isTextInput}`);
  console.log(`Role: ${focus1.role}`);
  console.log(`Subrole: ${focus1.subrole}`);
  console.log(`App: ${focus1.appName}`);
  console.log(`Editable: ${focus1.isEditable}`);
  console.log(`Has Selected Text Range: ${focus1.hasSelectedTextRange}`);
}

// Test 2: Continuous monitoring
console.log('\n--- Test 2: Continuous Monitoring (10 seconds) ---');
console.log('Click around different apps and text fields...\n');

let lastState = null;
const interval = setInterval(() => {
  const focus = checkFocus();
  if (focus) {
    const stateKey = `${focus.isTextInput}-${focus.role}-${focus.appName}`;
    if (stateKey !== lastState) {
      const time = new Date().toLocaleTimeString();
      console.log(`[${time}] isTextInput: ${focus.isTextInput}, role: "${focus.role}", app: "${focus.appName}"`);
      lastState = stateKey;
    }
  }
}, 200);

setTimeout(() => {
  clearInterval(interval);
  console.log('\n=== Test Complete ===');
  process.exit(0);
}, 10000);
