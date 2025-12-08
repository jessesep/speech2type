#!/usr/bin/env node
/**
 * Test script for IntentResolver
 * Tests the Claude-powered command understanding
 *
 * Usage:
 *   node test-intent-resolver.js              # Auto-detect (API if key, else CLI)
 *   node test-intent-resolver.js --cli        # Force Claude CLI mode
 *   node test-intent-resolver.js --api        # Force API mode (requires key)
 *   node test-intent-resolver.js -i           # Interactive mode
 *   node test-intent-resolver.js -t           # Run test phrases
 */

import createIntentResolver from './src/services/intent-resolver.js';
import readline from 'readline';

// Parse args
const args = process.argv.slice(2);
const forceMode = args.includes('--cli') ? 'cli' : args.includes('--api') ? 'api' : undefined;
const interactive = args.includes('--interactive') || args.includes('-i');
const runTests = args.includes('--test') || args.includes('-t');

// Create resolver
let resolver;
try {
  resolver = createIntentResolver({ mode: forceMode });
  console.log(`Using ${resolver.mode.toUpperCase()} mode\n`);
} catch (e) {
  console.error('Error:', e.message);
  console.error('\nOptions:');
  console.error('  --cli   Use Claude CLI (requires claude command, uses your login)');
  console.error('  --api   Use Anthropic API (requires ANTHROPIC_API_KEY env var)');
  process.exit(1);
}

// Test phrases
const testPhrases = [
  // Clear commands
  'send it',
  'submit',
  'go ahead',
  'undo that',
  'take it back',
  'oops',
  'clear everything',
  'start over',
  'copy that',
  'paste it here',

  // App switching
  'open chrome',
  'switch to terminal',
  'go to safari',

  // System
  'turn up the volume',
  'mute',
  'scroll down',

  // Speech2Type specific
  'stop listening',
  'switch to claude mode',
  'turn on smart mode',

  // Dictation (should return 'none')
  'I need to write an email to my boss about the project',
  'The quick brown fox jumps over the lazy dog',

  // Ambiguous
  'do it',
  'make it bigger',
  'fix that'
];

async function runTestPhrases() {
  console.log('=== Intent Resolver Test ===\n');
  console.log('Testing', testPhrases.length, 'phrases...\n');

  for (const phrase of testPhrases) {
    try {
      const result = await resolver.resolve(phrase);
      const confidence = Math.round(result.confidence * 100);
      const target = result.target ? ` → ${result.target}` : '';
      const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : '';

      console.log(`"${phrase}"`);
      console.log(`  → ${result.action} (${confidence}% confidence)${target}${latency}\n`);
    } catch (e) {
      console.log(`"${phrase}"`);
      console.log(`  → ERROR: ${e.message}\n`);
    }
  }

  console.log('\n=== Statistics ===');
  const stats = resolver.getStats();
  console.log(`Mode: ${stats.mode}`);
  console.log(`API calls: ${stats.calls}`);
  console.log(`Cache hits: ${stats.cacheHits}`);
  console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  console.log(`Avg latency: ${stats.avgLatencyMs}ms`);
  console.log(`Errors: ${stats.errors}`);
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n=== Interactive Mode ===');
  console.log(`Mode: ${resolver.mode.toUpperCase()}`);
  console.log('Type phrases to test. Type "quit" to exit, "stats" for statistics.\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === 'quit' || trimmed === 'exit' || trimmed === 'q') {
        console.log('\nFinal stats:', resolver.getStats());
        rl.close();
        return;
      }

      if (trimmed === 'stats') {
        console.log(resolver.getStats());
        prompt();
        return;
      }

      if (trimmed) {
        try {
          console.log('  Thinking...');
          const result = await resolver.resolve(trimmed);
          const confidence = Math.round(result.confidence * 100);
          const target = result.target ? ` → ${result.target}` : '';
          const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : '';
          console.log(`  → ${result.action} (${confidence}%)${target}${latency}\n`);
        } catch (e) {
          console.log(`  → ERROR: ${e.message}\n`);
        }
      }

      prompt();
    });
  };

  prompt();
}

// Main
if (interactive) {
  interactiveMode();
} else if (runTests) {
  runTestPhrases();
} else if (args.length === 0 || forceMode) {
  // Default: run tests then interactive
  console.log('Usage:');
  console.log('  node test-intent-resolver.js --test        Run test phrases');
  console.log('  node test-intent-resolver.js --interactive Interactive mode');
  console.log('  node test-intent-resolver.js --cli         Force CLI mode');
  console.log('  node test-intent-resolver.js --api         Force API mode');
  console.log('');
  runTestPhrases().then(() => interactiveMode());
} else {
  runTestPhrases().then(() => interactiveMode());
}
