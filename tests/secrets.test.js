/**
 * Tests for Secure Storage Service (secrets.js)
 *
 * Mocks keytar to test without requiring macOS Keychain access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock keytar before importing secrets module
const mockKeytar = {
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn()
};

vi.mock('keytar', () => ({
  default: mockKeytar,
  getPassword: mockKeytar.getPassword,
  setPassword: mockKeytar.setPassword,
  deletePassword: mockKeytar.deletePassword
}));

// Mock fs for migration tests
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
};

vi.mock('fs', () => ({
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync
}));

// Import after mocks are set up
const secrets = await import('../src/services/secrets.js');

describe('Secrets Service', () => {
  const TEST_KEY = 'test_key';
  const TEST_VALUE = 'test_value_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSecret', () => {
    it('retrieves secret from keychain', async () => {
      mockKeytar.getPassword.mockResolvedValue(TEST_VALUE);

      const result = await secrets.getSecret(TEST_KEY);

      expect(result).toBe(TEST_VALUE);
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('one-voice', TEST_KEY);
    });

    it('returns null for missing secret', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await secrets.getSecret(TEST_KEY);

      expect(result).toBeNull();
    });

    it('returns null and logs error on keytar failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKeytar.getPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await secrets.getSecret(TEST_KEY);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setSecret', () => {
    it('stores secret in keychain', async () => {
      mockKeytar.setPassword.mockResolvedValue();

      await secrets.setSecret(TEST_KEY, TEST_VALUE);

      expect(mockKeytar.setPassword).toHaveBeenCalledWith('one-voice', TEST_KEY, TEST_VALUE);
    });

    it('throws on keytar failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKeytar.setPassword.mockRejectedValue(new Error('Keychain error'));

      await expect(secrets.setSecret(TEST_KEY, TEST_VALUE)).rejects.toThrow('Keychain error');
      consoleSpy.mockRestore();
    });
  });

  describe('deleteSecret', () => {
    it('removes secret from keychain', async () => {
      mockKeytar.deletePassword.mockResolvedValue(true);

      await secrets.deleteSecret(TEST_KEY);

      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('one-voice', TEST_KEY);
    });

    it('handles keytar failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockKeytar.deletePassword.mockRejectedValue(new Error('Keychain error'));

      // Should not throw
      await secrets.deleteSecret(TEST_KEY);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('hasSecret', () => {
    it('returns true when secret exists', async () => {
      mockKeytar.getPassword.mockResolvedValue(TEST_VALUE);

      const result = await secrets.hasSecret(TEST_KEY);

      expect(result).toBe(true);
    });

    it('returns false when secret does not exist', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await secrets.hasSecret(TEST_KEY);

      expect(result).toBe(false);
    });
  });

  describe('validateKeyFormat', () => {
    it('validates Anthropic key format', () => {
      const validKey = 'sk-ant-api03-1234567890123456789012345678901234567890';
      expect(secrets.validateKeyFormat(validKey, 'anthropic')).toEqual({ valid: true });
    });

    it('rejects Anthropic key without correct prefix', () => {
      const result = secrets.validateKeyFormat('invalid-key-format', 'anthropic');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-ant-');
    });

    it('rejects too-short Anthropic key', () => {
      const result = secrets.validateKeyFormat('sk-ant-short', 'anthropic');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('validates Deepgram key length', () => {
      const validKey = '12345678901234567890abcdef';
      expect(secrets.validateKeyFormat(validKey, 'deepgram')).toEqual({ valid: true });
    });

    it('rejects too-short Deepgram key', () => {
      const result = secrets.validateKeyFormat('short', 'deepgram');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('rejects empty key', () => {
      expect(secrets.validateKeyFormat('', 'anthropic').valid).toBe(false);
      expect(secrets.validateKeyFormat(null, 'anthropic').valid).toBe(false);
      expect(secrets.validateKeyFormat(undefined, 'anthropic').valid).toBe(false);
    });
  });

  describe('getSecretsStatus', () => {
    it('returns status of all secrets', async () => {
      mockKeytar.getPassword
        .mockResolvedValueOnce('anthropic-key') // anthropic check
        .mockResolvedValueOnce(null);           // deepgram check

      const status = await secrets.getSecretsStatus();

      expect(status).toEqual({
        anthropic: true,
        deepgram: false
      });
    });
  });

  describe('Convenience functions', () => {
    it('getAnthropicKey calls getSecret with correct key', async () => {
      mockKeytar.getPassword.mockResolvedValue('test-key');

      await secrets.getAnthropicKey();

      expect(mockKeytar.getPassword).toHaveBeenCalledWith('one-voice', 'anthropic_api_key');
    });

    it('setAnthropicKey calls setSecret with correct key', async () => {
      mockKeytar.setPassword.mockResolvedValue();

      await secrets.setAnthropicKey('my-key');

      expect(mockKeytar.setPassword).toHaveBeenCalledWith('one-voice', 'anthropic_api_key', 'my-key');
    });

    it('getDeepgramKey calls getSecret with correct key', async () => {
      mockKeytar.getPassword.mockResolvedValue('test-key');

      await secrets.getDeepgramKey();

      expect(mockKeytar.getPassword).toHaveBeenCalledWith('one-voice', 'deepgram_api_key');
    });

    it('setDeepgramKey calls setSecret with correct key', async () => {
      mockKeytar.setPassword.mockResolvedValue();

      await secrets.setDeepgramKey('my-key');

      expect(mockKeytar.setPassword).toHaveBeenCalledWith('one-voice', 'deepgram_api_key', 'my-key');
    });
  });

  describe('migrateFromConfig', () => {
    it('returns empty when config file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await secrets.migrateFromConfig();

      expect(result).toEqual({ migrated: [] });
    });

    it('migrates anthropic key from config', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        anthropicApiKey: 'sk-ant-test-key-12345678901234567890',
        otherSetting: 'value'
      }));
      // hasAnthropicKey returns false (key not in keychain yet)
      mockKeytar.getPassword.mockResolvedValue(null);
      mockKeytar.setPassword.mockResolvedValue();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await secrets.migrateFromConfig();

      expect(result.migrated).toContain('anthropic_api_key');
      expect(mockKeytar.setPassword).toHaveBeenCalledWith('one-voice', 'anthropic_api_key', 'sk-ant-test-key-12345678901234567890');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('migrates deepgram key from config', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        deepgram_api_key: 'deepgram-test-key-123'
      }));
      mockKeytar.getPassword.mockResolvedValue(null);
      mockKeytar.setPassword.mockResolvedValue();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await secrets.migrateFromConfig();

      expect(result.migrated).toContain('deepgram_api_key');
      consoleSpy.mockRestore();
    });

    it('skips migration if key already in keychain', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        anthropicApiKey: 'sk-ant-test-key'
      }));
      // hasAnthropicKey returns true (key already in keychain)
      mockKeytar.getPassword.mockResolvedValue('existing-key');

      const result = await secrets.migrateFromConfig();

      expect(result.migrated).toEqual([]);
      expect(mockKeytar.setPassword).not.toHaveBeenCalled();
    });

    it('handles migration errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => { throw new Error('Read error'); });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await secrets.migrateFromConfig();

      expect(result.migrated).toEqual([]);
      expect(result.error).toBe('Read error');
      consoleSpy.mockRestore();
    });
  });

  describe('Default export', () => {
    it('exports all functions', () => {
      const defaultExport = secrets.default;

      expect(defaultExport.getSecret).toBeDefined();
      expect(defaultExport.setSecret).toBeDefined();
      expect(defaultExport.deleteSecret).toBeDefined();
      expect(defaultExport.hasSecret).toBeDefined();
      expect(defaultExport.getAnthropicKey).toBeDefined();
      expect(defaultExport.setAnthropicKey).toBeDefined();
      expect(defaultExport.hasAnthropicKey).toBeDefined();
      expect(defaultExport.deleteAnthropicKey).toBeDefined();
      expect(defaultExport.getDeepgramKey).toBeDefined();
      expect(defaultExport.setDeepgramKey).toBeDefined();
      expect(defaultExport.hasDeepgramKey).toBeDefined();
      expect(defaultExport.deleteDeepgramKey).toBeDefined();
      expect(defaultExport.migrateFromConfig).toBeDefined();
      expect(defaultExport.validateKeyFormat).toBeDefined();
      expect(defaultExport.getSecretsStatus).toBeDefined();
    });
  });
});
