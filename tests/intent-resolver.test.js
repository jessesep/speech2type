/**
 * Tests for Intent Resolver Service
 *
 * Tests both API mode (IntentResolver) and CLI mode (IntentResolverCLI)
 * with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Anthropic SDK
const mockCreate = vi.fn();

class MockAnthropic {
  constructor(options) {
    this.options = options;
    this.messages = { create: mockCreate };
  }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic
}));

// Mock child_process for CLI mode
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Mock secrets
const mockGetAnthropicKey = vi.fn();
vi.mock('../src/services/secrets.js', () => ({
  getAnthropicKey: mockGetAnthropicKey
}));

// Import after mocks
const {
  IntentResolver,
  IntentResolverCLI,
  createIntentResolver,
  createIntentResolverAsync,
  CORE_ACTIONS
} = await import('../src/services/intent-resolver.js');

describe('Intent Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('CORE_ACTIONS', () => {
    it('defines expected actions', () => {
      expect(CORE_ACTIONS.ENTER).toBe('enter');
      expect(CORE_ACTIONS.UNDO).toBe('undo');
      expect(CORE_ACTIONS.CLEAR_ALL).toBe('clear_all');
      expect(CORE_ACTIONS.COPY).toBe('copy');
      expect(CORE_ACTIONS.PASTE).toBe('paste');
      expect(CORE_ACTIONS.FOCUS_APP).toBe('focus_app');
      expect(CORE_ACTIONS.STOP_LISTENING).toBe('stop_listening');
      expect(CORE_ACTIONS.NONE).toBe('none');
      expect(CORE_ACTIONS.UNKNOWN).toBe('unknown');
    });
  });

  describe('IntentResolver (API mode)', () => {
    let resolver;

    beforeEach(() => {
      resolver = new IntentResolver('test-api-key');
    });

    it('throws without API key', () => {
      expect(() => new IntentResolver()).toThrow('API key required');
    });

    it('initializes with API key', () => {
      expect(resolver.mode).toBe('api');
      // Class is instantiated with client property
      expect(resolver.client).toBeDefined();
    });

    it('resolves speech to action', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 0.95}' }]
      });

      const result = await resolver.resolve('send it');

      expect(result.action).toBe('enter');
      expect(result.confidence).toBe(0.95);
      expect(result.mode).toBe('api');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100
        })
      );
    });

    it('includes context in API call', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "focus_app", "confidence": 0.9, "target": "safari"}' }]
      });

      const result = await resolver.resolve('go to safari', { appName: 'Terminal' });

      expect(result.action).toBe('focus_app');
      expect(result.target).toBe('safari');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Terminal');
    });

    it('caches results', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 0.9}' }]
      });

      // First call - hits API
      await resolver.resolve('send it');
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const cached = await resolver.resolve('send it');
      expect(mockCreate).toHaveBeenCalledTimes(1); // Not called again
      expect(cached.action).toBe('enter');
    });

    it('different context = different cache key', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 0.9}' }]
      });

      await resolver.resolve('send it', { appName: 'Chrome' });
      await resolver.resolve('send it', { appName: 'Safari' });

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('normalizes confidence to 0-1 range', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 1.5}' }]
      });

      const result = await resolver.resolve('send it');
      expect(result.confidence).toBe(1);

      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": -0.5}' }]
      });

      // Clear cache by using different speech
      const result2 = await resolver.resolve('submit now');
      expect(result2.confidence).toBe(0);
    });

    it('handles API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await resolver.resolve('test');

      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.error).toBe('API Error');
      consoleSpy.mockRestore();
    });

    it('parses JSON from wrapped response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'Here is the result: {"action": "copy", "confidence": 0.85}' }]
      });

      const result = await resolver.resolve('copy that');
      expect(result.action).toBe('copy');
      expect(result.confidence).toBe(0.85);
    });

    it('handles malformed JSON', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'not json at all' }]
      });

      const result = await resolver.resolve('test');
      expect(result.action).toBe('unknown');
    });

    it('tracks statistics', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 0.9}' }]
      });

      await resolver.resolve('test1');
      await resolver.resolve('test2');
      await resolver.resolve('test1'); // Cache hit

      const stats = resolver.getStats();
      expect(stats.calls).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.mode).toBe('api');
      expect(stats.cacheSize).toBe(2);
    });

    it('implements LRU cache eviction', async () => {
      resolver.cacheMaxSize = 2; // Small cache for test
      mockCreate.mockResolvedValue({
        content: [{ text: '{"action": "enter", "confidence": 0.9}' }]
      });

      await resolver.resolve('test1');
      await resolver.resolve('test2');
      await resolver.resolve('test3'); // Should evict test1

      expect(resolver.cache.size).toBe(2);
      expect(resolver.cache.has('test1|')).toBe(false);
    });
  });

  describe('IntentResolver.looksLikeCommand()', () => {
    let resolver;

    beforeEach(() => {
      resolver = new IntentResolver('test-key');
    });

    it('identifies command-like phrases', () => {
      expect(resolver.looksLikeCommand('send it')).toBe(true);
      expect(resolver.looksLikeCommand('go to chrome')).toBe(true);
      expect(resolver.looksLikeCommand('open terminal')).toBe(true);
      expect(resolver.looksLikeCommand('stop')).toBe(true);
      expect(resolver.looksLikeCommand('undo that')).toBe(true);
      expect(resolver.looksLikeCommand('copy this')).toBe(true);
      expect(resolver.looksLikeCommand('scroll down')).toBe(true);
      expect(resolver.looksLikeCommand('do it now')).toBe(true);
      expect(resolver.looksLikeCommand('okay google')).toBe(true);
    });

    it('rejects long dictation', () => {
      expect(resolver.looksLikeCommand('I need to write a long email to my boss')).toBe(false);
      expect(resolver.looksLikeCommand('The quick brown fox jumps over the lazy dog')).toBe(false);
    });

    it('rejects non-command short phrases', () => {
      expect(resolver.looksLikeCommand('hello world')).toBe(false);
      expect(resolver.looksLikeCommand('my name')).toBe(false);
    });
  });

  describe('IntentResolverCLI', () => {
    let resolver;

    beforeEach(() => {
      resolver = new IntentResolverCLI();
    });

    it('initializes in CLI mode', () => {
      expect(resolver.mode).toBe('cli');
    });

    it('resolves speech using Claude CLI', async () => {
      // Mock spawn to simulate successful CLI execution
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Simulate stdout data and process close
      const resolvePromise = resolver.resolve('send it');

      // Get the event handlers
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(c => c[0] === 'data')[1];
      const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')[1];

      // Simulate output
      stdoutHandler(Buffer.from('{"action": "enter", "confidence": 0.9}'));
      closeHandler(0);

      const result = await resolvePromise;

      expect(result.action).toBe('enter');
      expect(result.confidence).toBe(0.9);
      expect(result.mode).toBe('cli');
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['-p', expect.any(String), '--model', 'haiku']),
        expect.any(Object)
      );
    });

    it('handles CLI errors', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const resolvePromise = resolver.resolve('test');

      const stderrHandler = mockProcess.stderr.on.mock.calls.find(c => c[0] === 'data')[1];
      const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')[1];

      stderrHandler(Buffer.from('CLI Error'));
      closeHandler(1);

      const result = await resolvePromise;

      expect(result.action).toBe('unknown');
      expect(result.error).toContain('CLI Error');
      consoleSpy.mockRestore();
    });

    it('handles spawn failure', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const resolvePromise = resolver.resolve('test');

      const errorHandler = mockProcess.on.mock.calls.find(c => c[0] === 'error')[1];
      errorHandler(new Error('spawn failed'));

      const result = await resolvePromise;

      expect(result.action).toBe('unknown');
      expect(result.error).toContain('spawn failed');
      consoleSpy.mockRestore();
    });

    it('caches CLI results', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      const promise1 = resolver.resolve('test');
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(c => c[0] === 'data')[1];
      const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')[1];
      stdoutHandler(Buffer.from('{"action": "enter", "confidence": 0.9}'));
      closeHandler(0);
      await promise1;

      // Second call should use cache
      const result2 = await resolver.resolve('test');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(result2.action).toBe('enter');
    });

    it('has looksLikeCommand method', () => {
      expect(resolver.looksLikeCommand('send it')).toBe(true);
      expect(resolver.looksLikeCommand('I am writing a document')).toBe(false);
    });

    it('tracks statistics', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      const promise = resolver.resolve('test');
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(c => c[0] === 'data')[1];
      const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')[1];
      stdoutHandler(Buffer.from('{"action": "enter", "confidence": 0.9}'));
      closeHandler(0);
      await promise;

      // Cache hit
      await resolver.resolve('test');

      const stats = resolver.getStats();
      expect(stats.calls).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.mode).toBe('cli');
    });
  });

  describe('createIntentResolver (sync factory)', () => {
    it('creates CLI resolver when mode is cli', () => {
      const resolver = createIntentResolver({ mode: 'cli' });
      expect(resolver.mode).toBe('cli');
    });

    it('creates API resolver when mode is api with key', () => {
      const resolver = createIntentResolver({ mode: 'api', apiKey: 'test-key' });
      expect(resolver.mode).toBe('api');
    });

    it('throws when api mode without key', () => {
      expect(() => createIntentResolver({ mode: 'api' }))
        .toThrow('API mode requires');
    });

    it('uses env var for api mode', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      const resolver = createIntentResolver({ mode: 'api' });
      expect(resolver.mode).toBe('api');
    });

    it('auto-detects API mode when key available', () => {
      const resolver = createIntentResolver({ apiKey: 'test-key' });
      expect(resolver.mode).toBe('api');
    });

    it('auto-detects CLI mode when no key', () => {
      const resolver = createIntentResolver();
      expect(resolver.mode).toBe('cli');
    });
  });

  describe('createIntentResolverAsync', () => {
    it('creates CLI resolver when mode is cli', async () => {
      const resolver = await createIntentResolverAsync({ mode: 'cli' });
      expect(resolver.mode).toBe('cli');
    });

    it('creates API resolver with keychain key', async () => {
      mockGetAnthropicKey.mockResolvedValue('keychain-key');

      const resolver = await createIntentResolverAsync();
      expect(resolver.mode).toBe('api');
      expect(mockGetAnthropicKey).toHaveBeenCalled();
    });

    it('prefers passed apiKey over keychain', async () => {
      mockGetAnthropicKey.mockResolvedValue('keychain-key');

      const resolver = await createIntentResolverAsync({ apiKey: 'passed-key' });
      expect(resolver.mode).toBe('api');
      // The passed key is used (we can verify mode is 'api')
      expect(resolver.client).toBeDefined();
    });

    it('falls back to CLI when no key available', async () => {
      mockGetAnthropicKey.mockResolvedValue(null);

      const resolver = await createIntentResolverAsync();
      expect(resolver.mode).toBe('cli');
    });

    it('handles keychain error gracefully', async () => {
      mockGetAnthropicKey.mockRejectedValue(new Error('Keychain error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const resolver = await createIntentResolverAsync();

      expect(resolver.mode).toBe('cli');
      consoleSpy.mockRestore();
    });

    it('throws when api mode without any key', async () => {
      mockGetAnthropicKey.mockResolvedValue(null);

      await expect(createIntentResolverAsync({ mode: 'api' }))
        .rejects.toThrow('API mode requires');
    });
  });
});
