#!/usr/bin/env node
/**
 * Test script for IntentResolver
 * Tests the Claude-powered command understanding
 */

import { IntentResolver } from './src/services/intent-resolver.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import readline from 'readline';

// Load API key from config
const configPath = join(homedir(), '.config', 'speech2type', 'config.json');
let apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey && existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    apiKey = config.anthropicApiKey;
  } catch (e) {
    // ignore
  }
}

if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY environment variable or config.anthropicApiKey required');
  console.error('Set it with: export ANTHROPIC_API_KEY=your-key');
  process.exit(1);
}

const resolver = new IntentResolver(apiKey);

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

async function runTests() {
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
  console.log('Type phrases to test. Type "quit" to exit, "stats" for statistics.\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === 'quit' || trimmed === 'exit') {
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

// Run tests then interactive mode
const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else if (args.includes('--test') || args.includes('-t')) {
  runTests();
} else {
  console.log('Usage:');
  console.log('  node test-intent-resolver.js --test        Run test phrases');
  console.log('  node test-intent-resolver.js --interactive Interactive mode');
  console.log('');
  runTests().then(() => interactiveMode());
}
