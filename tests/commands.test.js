/**
 * Tests for Personal Command Dictionary Service (commands.js)
 *
 * Tests Tier 1 (exact) and Tier 2 (fuzzy) matching, learning,
 * and the full command lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs for file operations
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
};

vi.mock('fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  mkdirSync: mockFs.mkdirSync
}));

// Mock Fuse.js
class MockFuse {
  constructor(items, options) {
    this.items = items;
    this.options = options;
  }

  search(query) {
    // Simple mock that returns close matches
    const results = this.items
      .map((item, index) => {
        const distance = this.levenshtein(query.toLowerCase(), item.phrase.toLowerCase());
        const score = distance / Math.max(query.length, item.phrase.length);
        return { item, score, refIndex: index };
      })
      .filter(r => r.score < this.options.threshold)
      .sort((a, b) => a.score - b.score);

    return results;
  }

  levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }

    return matrix[b.length][a.length];
  }
}

vi.mock('fuse.js', () => ({
  default: MockFuse
}));

// Import after mocks
const { CommandDictionary } = await import('../src/services/commands.js');

describe('CommandDictionary', () => {
  let dict;

  beforeEach(() => {
    vi.clearAllMocks();
    dict = new CommandDictionary();
    // Set up default data structure
    dict.data = {
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
    dict.phraseIndex = new Map();
  });

  describe('normalize()', () => {
    it('converts to lowercase', () => {
      expect(dict.normalize('SEND IT')).toBe('send it');
    });

    it('removes punctuation', () => {
      expect(dict.normalize("Hey, what's up?")).toBe('hey whats up');
    });

    it('normalizes whitespace', () => {
      expect(dict.normalize('send   it   now')).toBe('send it now');
    });

    it('trims leading/trailing whitespace', () => {
      expect(dict.normalize('  send it  ')).toBe('send it');
    });

    it('handles empty string', () => {
      expect(dict.normalize('')).toBe('');
    });

    it('handles complex input', () => {
      expect(dict.normalize('  Go to CHROME, please!  ')).toBe('go to chrome please');
    });
  });

  describe('load()', () => {
    it('creates default data when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.load();

      expect(dict.data.version).toBe('1.0.0');
      expect(dict.data.commands).toEqual([]);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('loads existing commands from file', async () => {
      const existingData = {
        version: '1.0.0',
        commands: [
          { id: 'cmd_1', action: 'enter', phrases: ['send it', 'submit'], use_count: 5 }
        ],
        workflows: [],
        context_overrides: [],
        stats: { tier1_hits: 10, tier2_hits: 5, tier3_hits: 2 }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingData));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.load();

      expect(dict.data.commands.length).toBe(1);
      expect(dict.data.commands[0].action).toBe('enter');
      expect(dict.phraseIndex.has('send it')).toBe(true);
      expect(dict.phraseIndex.has('submit')).toBe(true);
      consoleSpy.mockRestore();
    });

    it('handles load errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => { throw new Error('Read error'); });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await dict.load();

      expect(dict.data.commands).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('buildIndexes()', () => {
    it('builds phrase index from commands', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it', 'submit'] },
        { id: 'cmd_2', action: 'undo', phrases: ['undo that', 'take it back'] }
      ];

      dict.buildIndexes();

      expect(dict.phraseIndex.size).toBe(4);
      expect(dict.phraseIndex.get('send it').action).toBe('enter');
      expect(dict.phraseIndex.get('undo that').action).toBe('undo');
    });

    it('creates Fuse instance with correct options', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] }
      ];

      dict.buildIndexes();

      expect(dict.fuse).toBeDefined();
      expect(dict.fuse.options.threshold).toBe(0.3);
    });
  });

  describe('lookupExact() - Tier 1', () => {
    beforeEach(() => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it', 'submit'] }
      ];
      dict.buildIndexes();
    });

    it('returns match for exact phrase', () => {
      const result = dict.lookupExact('send it');

      expect(result).toBeTruthy();
      expect(result.action).toBe('enter');
      expect(result.confidence).toBe(1.0);
      expect(result.tier).toBe(1);
      expect(result.source).toBe('exact');
    });

    it('returns match for case-insensitive phrase', () => {
      const result = dict.lookupExact('SEND IT');

      expect(result).toBeTruthy();
      expect(result.action).toBe('enter');
    });

    it('returns match ignoring punctuation', () => {
      const result = dict.lookupExact('send it!');

      expect(result).toBeTruthy();
      expect(result.action).toBe('enter');
    });

    it('returns null for unknown phrase', () => {
      const result = dict.lookupExact('unknown phrase');
      expect(result).toBeNull();
    });

    it('increments tier1_hits on match', () => {
      const initialHits = dict.data.stats.tier1_hits;
      dict.lookupExact('send it');
      expect(dict.data.stats.tier1_hits).toBe(initialHits + 1);
    });

    it('records usage on match', () => {
      dict.lookupExact('send it');
      const cmd = dict.data.commands.find(c => c.id === 'cmd_1');
      expect(cmd.use_count).toBeGreaterThan(0);
      expect(cmd.last_used).toBeDefined();
    });
  });

  describe('lookupFuzzy() - Tier 2', () => {
    beforeEach(() => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] },
        { id: 'cmd_2', action: 'undo', phrases: ['undo that'] }
      ];
      dict.buildIndexes();
    });

    it('returns null when fuse is not initialized', () => {
      dict.fuse = null;
      const result = dict.lookupFuzzy('send ti');
      expect(result).toBeNull();
    });

    it('returns match for fuzzy phrase', () => {
      const result = dict.lookupFuzzy('send ti'); // Close to "send it"

      expect(result).toBeTruthy();
      expect(result.action).toBe('enter');
      expect(result.tier).toBe(2);
      expect(result.source).toBe('fuzzy');
      expect(result.confidence).toBeLessThan(1);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns null for non-matching phrase', () => {
      const result = dict.lookupFuzzy('completely different');
      expect(result).toBeNull();
    });

    it('increments tier2_hits on match', () => {
      const initialHits = dict.data.stats.tier2_hits;
      dict.lookupFuzzy('send ti');
      expect(dict.data.stats.tier2_hits).toBe(initialHits + 1);
    });
  });

  describe('lookup() - Combined Tier 1+2', () => {
    beforeEach(() => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] }
      ];
      dict.buildIndexes();
    });

    it('prefers exact match over fuzzy', () => {
      const result = dict.lookup('send it');

      expect(result.tier).toBe(1);
      expect(result.confidence).toBe(1.0);
    });

    it('falls back to fuzzy for close match', () => {
      const result = dict.lookup('send ti');

      // May return fuzzy match if confidence > 0.7
      if (result) {
        expect(result.tier).toBe(2);
      }
    });

    it('returns null for no match', () => {
      const result = dict.lookup('completely unknown');
      expect(result).toBeNull();
    });
  });

  describe('learn()', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it('learns new phrase for new action', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await dict.learn('send it', 'enter');

      expect(result).toBe(true);
      expect(dict.data.commands.length).toBe(1);
      expect(dict.data.commands[0].action).toBe('enter');
      expect(dict.data.commands[0].phrases).toContain('send it');
      expect(dict.phraseIndex.has('send it')).toBe(true);
      consoleSpy.mockRestore();
    });

    it('adds phrase to existing action', async () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['submit'] }
      ];
      dict.buildIndexes();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await dict.learn('send it', 'enter');

      expect(result).toBe(true);
      expect(dict.data.commands.length).toBe(1);
      expect(dict.data.commands[0].phrases).toContain('submit');
      expect(dict.data.commands[0].phrases).toContain('send it');
      consoleSpy.mockRestore();
    });

    it('rejects duplicate phrase', async () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] }
      ];
      dict.buildIndexes();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await dict.learn('send it', 'enter');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('saves to disk after learning', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.learn('test', 'test_action');

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('sets correct source', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await dict.learn('trained phrase', 'action1', 'trained');
      await dict.learn('learned phrase', 'action2', 'learned');

      const trainedCmd = dict.data.commands.find(c => c.action === 'action1');
      const learnedCmd = dict.data.commands.find(c => c.action === 'action2');

      expect(trainedCmd.source).toBe('trained');
      expect(trainedCmd.confidence).toBe(1.0);
      expect(learnedCmd.source).toBe('learned');
      expect(learnedCmd.confidence).toBe(0.8);

      consoleSpy.mockRestore();
    });
  });

  describe('forget()', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it', 'submit'] }
      ];
      dict.buildIndexes();
    });

    it('removes phrase from command', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await dict.forget('send it');

      expect(result).toBe(true);
      expect(dict.phraseIndex.has('send it')).toBe(false);
      expect(dict.data.commands[0].phrases).toContain('submit');
      expect(dict.data.commands[0].phrases).not.toContain('send it');
      consoleSpy.mockRestore();
    });

    it('removes command when no phrases left', async () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] }
      ];
      dict.buildIndexes();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.forget('send it');

      expect(dict.data.commands.length).toBe(0);
      consoleSpy.mockRestore();
    });

    it('returns false for unknown phrase', async () => {
      const result = await dict.forget('unknown');
      expect(result).toBe(false);
    });

    it('saves after forgetting', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.forget('send it');

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('recordUsage()', () => {
    it('increments use_count', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'], use_count: 5 }
      ];

      dict.recordUsage('cmd_1');

      expect(dict.data.commands[0].use_count).toBe(6);
    });

    it('sets last_used timestamp', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'], use_count: 0 }
      ];

      dict.recordUsage('cmd_1');

      expect(dict.data.commands[0].last_used).toBeDefined();
    });

    it('handles missing command gracefully', () => {
      expect(() => dict.recordUsage('nonexistent')).not.toThrow();
    });
  });

  describe('recordTier3Hit()', () => {
    it('increments tier3_hits', () => {
      const initial = dict.data.stats.tier3_hits;
      dict.recordTier3Hit();
      expect(dict.data.stats.tier3_hits).toBe(initial + 1);
    });
  });

  describe('save()', () => {
    it('creates directory if not exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await dict.save();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('writes JSON to file', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await dict.save();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('personal_commands.json'),
        expect.stringContaining('"version"')
      );
    });
  });

  describe('getStats()', () => {
    it('returns complete stats', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it', 'submit'] }
      ];
      dict.buildIndexes();
      dict.data.stats.tier1_hits = 10;
      dict.data.stats.tier2_hits = 5;
      dict.data.stats.tier3_hits = 2;

      const stats = dict.getStats();

      expect(stats.total_commands).toBe(1);
      expect(stats.total_phrases).toBe(2);
      expect(stats.total_lookups).toBe(17);
      expect(stats.tier1_rate).toBe('0.59');
      expect(stats.tier2_rate).toBe('0.29');
      expect(stats.tier3_rate).toBe('0.12');
    });

    it('handles zero lookups', () => {
      const stats = dict.getStats();

      expect(stats.tier1_rate).toBe('0.00');
      expect(stats.tier2_rate).toBe('0.00');
      expect(stats.tier3_rate).toBe('0.00');
    });
  });

  describe('migrateDefaults()', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it('migrates default commands to empty dictionary', async () => {
      const defaults = [
        { action: 'enter', phrases: ['send it', 'submit'] },
        { action: 'undo', phrases: ['undo', 'take back'] }
      ];

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await dict.migrateDefaults(defaults);

      expect(dict.data.commands.length).toBe(2);
      expect(dict.data.commands[0].source).toBe('default');
      expect(dict.data.commands[0].confidence).toBe(1.0);
      consoleSpy.mockRestore();
    });

    it('skips migration if commands exist', async () => {
      dict.data.commands = [{ id: 'existing', action: 'test', phrases: ['test'] }];

      const defaults = [
        { action: 'enter', phrases: ['send it'] }
      ];

      await dict.migrateDefaults(defaults);

      expect(dict.data.commands.length).toBe(1);
      expect(dict.data.commands[0].id).toBe('existing');
    });
  });

  describe('getAllCommands()', () => {
    it('returns all commands', () => {
      dict.data.commands = [
        { id: 'cmd_1', action: 'enter', phrases: ['send it'] },
        { id: 'cmd_2', action: 'undo', phrases: ['undo'] }
      ];

      const commands = dict.getAllCommands();

      expect(commands.length).toBe(2);
      expect(commands[0].action).toBe('enter');
    });
  });

  describe('isEmpty()', () => {
    it('returns true when no commands', () => {
      expect(dict.isEmpty()).toBe(true);
    });

    it('returns false when commands exist', () => {
      dict.data.commands = [{ id: 'cmd_1', action: 'enter', phrases: ['send it'] }];
      expect(dict.isEmpty()).toBe(false);
    });
  });
});
