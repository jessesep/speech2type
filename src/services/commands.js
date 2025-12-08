/**
 * Personal Command Dictionary Service (Phase 1.2)
 *
 * The learning layer that makes ONE get smarter over time.
 * Stores user-specific phrase→action mappings enabling:
 *   1. Tier 1 matching - Instant local lookup, no API call
 *   2. Learning - New phrases added automatically when AI resolves with high confidence
 *   3. Fuzzy matching - Tier 2 handles typos and variations
 *   4. Personalization - Each user builds their own vocabulary
 */

import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const COMMANDS_PATH = path.join(
  process.env.HOME,
  '.config/one/personal_commands.json'
);

const DEFAULT_COMMANDS = {
  version: '1.0.0',
  commands: [],
  workflows: [],
  context_overrides: [],
  stats: {
    total_commands: 0,
    total_phrases: 0,
    tier1_hits: 0,
    tier2_hits: 0,
    tier3_hits: 0,
    last_cleanup: null
  }
};

/**
 * CommandDictionary class
 * Manages personal command vocabulary with exact and fuzzy matching
 */
export class CommandDictionary {
  constructor() {
    this.data = null;
    this.fuse = null;  // Fuzzy search index
    this.phraseIndex = new Map();  // phrase → command for O(1) lookup
  }

  /**
   * Load commands from disk or create default file
   */
  async load() {
    try {
      if (fs.existsSync(COMMANDS_PATH)) {
        this.data = JSON.parse(fs.readFileSync(COMMANDS_PATH, 'utf8'));
      } else {
        this.data = {
          ...DEFAULT_COMMANDS,
          created_at: new Date().toISOString()
        };
        await this.save();
      }

      this.buildIndexes();
      console.log(`[Commands] Loaded ${this.data.commands.length} commands, ${this.phraseIndex.size} phrases`);

    } catch (e) {
      console.error('[Commands] Failed to load:', e);
      this.data = { ...DEFAULT_COMMANDS };
    }
  }

  /**
   * Build search indexes (exact match Map + Fuse.js fuzzy index)
   */
  buildIndexes() {
    // Build exact match index
    this.phraseIndex.clear();
    for (const cmd of this.data.commands) {
      for (const phrase of cmd.phrases) {
        this.phraseIndex.set(this.normalize(phrase), cmd);
      }
    }

    // Build fuzzy search index from all phrases
    const allPhrases = this.data.commands.flatMap(cmd =>
      cmd.phrases.map(phrase => ({
        phrase: this.normalize(phrase),
        action: cmd.action,
        commandId: cmd.id
      }))
    );

    this.fuse = new Fuse(allPhrases, {
      keys: ['phrase'],
      threshold: 0.3,  // 0 = exact, 1 = match anything
      distance: 100,
      includeScore: true
    });
  }

  /**
   * Normalize phrase for matching (lowercase, strip punctuation, normalize whitespace)
   * @param {string} phrase
   * @returns {string}
   */
  normalize(phrase) {
    return phrase
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ');     // Normalize whitespace
  }

  /**
   * TIER 1: Exact match lookup
   * @param {string} phrase - User's spoken phrase
   * @returns {object|null} - Match result or null
   */
  lookupExact(phrase) {
    const normalized = this.normalize(phrase);
    const cmd = this.phraseIndex.get(normalized);

    if (cmd) {
      this.data.stats.tier1_hits++;
      this.recordUsage(cmd.id);
      return {
        action: cmd.action,
        confidence: 1.0,
        tier: 1,
        source: 'exact'
      };
    }

    return null;
  }

  /**
   * TIER 2: Fuzzy match lookup using Fuse.js
   * @param {string} phrase - User's spoken phrase
   * @returns {object|null} - Match result or null
   */
  lookupFuzzy(phrase) {
    if (!this.fuse) return null;

    const normalized = this.normalize(phrase);
    const results = this.fuse.search(normalized);

    if (results.length > 0 && results[0].score < 0.3) {
      const match = results[0].item;
      const confidence = 1 - results[0].score;

      this.data.stats.tier2_hits++;
      this.recordUsage(match.commandId);

      return {
        action: match.action,
        confidence,
        tier: 2,
        source: 'fuzzy',
        matchedPhrase: match.phrase
      };
    }

    return null;
  }

  /**
   * Combined lookup (Tier 1 + 2)
   * @param {string} phrase - User's spoken phrase
   * @returns {object|null} - Match result or null
   */
  lookup(phrase) {
    // Try exact first
    const exact = this.lookupExact(phrase);
    if (exact) return exact;

    // Fall back to fuzzy (only accept high confidence)
    const fuzzy = this.lookupFuzzy(phrase);
    if (fuzzy && fuzzy.confidence > 0.7) return fuzzy;

    return null;
  }

  /**
   * Learn a new phrase for an action
   * @param {string} phrase - The phrase to learn
   * @param {string} action - The action it maps to
   * @param {string} source - Source: 'learned', 'trained', 'default'
   * @returns {Promise<boolean>} - True if learned successfully
   */
  async learn(phrase, action, source = 'learned') {
    const normalized = this.normalize(phrase);

    // Check if already exists
    if (this.phraseIndex.has(normalized)) {
      console.log(`[Commands] Phrase already known: "${phrase}"`);
      return false;
    }

    // Find or create command entry
    let cmd = this.data.commands.find(c => c.action === action);

    if (cmd) {
      // Add phrase to existing command
      cmd.phrases.push(phrase);
      cmd.updated_at = new Date().toISOString();
    } else {
      // Create new command entry
      cmd = {
        id: `cmd_${Date.now()}`,
        action,
        phrases: [phrase],
        source,
        confidence: source === 'trained' ? 1.0 : 0.8,
        use_count: 0,
        created_at: new Date().toISOString()
      };
      this.data.commands.push(cmd);
    }

    // Update indexes
    this.phraseIndex.set(normalized, cmd);
    this.data.stats.total_phrases++;
    this.data.updated_at = new Date().toISOString();

    await this.save();
    this.buildIndexes();  // Rebuild fuzzy index

    console.log(`[Commands] Learned: "${phrase}" → ${action}`);
    return true;
  }

  /**
   * Forget a phrase
   * @param {string} phrase - The phrase to forget
   * @returns {Promise<boolean>} - True if forgotten successfully
   */
  async forget(phrase) {
    const normalized = this.normalize(phrase);
    const cmd = this.phraseIndex.get(normalized);

    if (!cmd) return false;

    // Remove phrase from command
    cmd.phrases = cmd.phrases.filter(p => this.normalize(p) !== normalized);

    // If no phrases left, remove the command entirely
    if (cmd.phrases.length === 0) {
      this.data.commands = this.data.commands.filter(c => c.id !== cmd.id);
    }

    this.phraseIndex.delete(normalized);
    this.data.stats.total_phrases--;
    this.data.updated_at = new Date().toISOString();

    await this.save();
    this.buildIndexes();

    console.log(`[Commands] Forgot: "${phrase}"`);
    return true;
  }

  /**
   * Record command usage for analytics
   * @param {string} commandId
   */
  recordUsage(commandId) {
    const cmd = this.data.commands.find(c => c.id === commandId);
    if (cmd) {
      cmd.use_count = (cmd.use_count || 0) + 1;
      cmd.last_used = new Date().toISOString();
    }
  }

  /**
   * Record a Tier 3 hit (AI fallback)
   */
  recordTier3Hit() {
    this.data.stats.tier3_hits++;
  }

  /**
   * Save commands to disk
   */
  async save() {
    const dir = path.dirname(COMMANDS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COMMANDS_PATH, JSON.stringify(this.data, null, 2));
  }

  /**
   * Get statistics for monitoring
   * @returns {object} - Stats object
   */
  getStats() {
    const total = this.data.stats.tier1_hits +
                  this.data.stats.tier2_hits +
                  this.data.stats.tier3_hits;

    return {
      ...this.data.stats,
      total_commands: this.data.commands.length,
      total_phrases: this.phraseIndex.size,
      total_lookups: total,
      tier1_rate: total > 0 ? (this.data.stats.tier1_hits / total).toFixed(2) : '0.00',
      tier2_rate: total > 0 ? (this.data.stats.tier2_hits / total).toFixed(2) : '0.00',
      tier3_rate: total > 0 ? (this.data.stats.tier3_hits / total).toFixed(2) : '0.00'
    };
  }

  /**
   * Migrate default commands from bundled data
   * Only runs if no commands exist yet
   * @param {Array} defaultCommands - Array of {action, phrases}
   */
  async migrateDefaults(defaultCommands) {
    if (this.data.commands.length > 0) return;  // Already have data

    console.log('[Commands] Migrating default commands...');

    for (const cmd of defaultCommands) {
      this.data.commands.push({
        id: `cmd_default_${cmd.action}`,
        action: cmd.action,
        phrases: cmd.phrases,
        source: 'default',
        confidence: 1.0,
        use_count: 0,
        created_at: new Date().toISOString()
      });
    }

    this.data.stats.total_commands = this.data.commands.length;
    await this.save();
    this.buildIndexes();

    console.log(`[Commands] Migrated ${this.data.commands.length} default commands`);
  }

  /**
   * Get all commands (for debugging/export)
   * @returns {Array}
   */
  getAllCommands() {
    return this.data.commands;
  }

  /**
   * Check if the dictionary has any commands
   * @returns {boolean}
   */
  isEmpty() {
    return this.data.commands.length === 0;
  }
}

// Singleton instance
export const commandDictionary = new CommandDictionary();

export default commandDictionary;
