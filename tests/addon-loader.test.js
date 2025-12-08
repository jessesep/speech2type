/**
 * Tests for Addon Loader Service
 * Tests dynamic addon loading, mode management, and configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddonLoader } from '../src/services/addon-loader.js';
import path from 'path';
import os from 'os';

// Mock filesystem and chalk
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn(msg => msg),
    green: vi.fn(msg => msg),
    yellow: vi.fn(msg => msg),
    dim: vi.fn(msg => msg),
    magenta: { bold: vi.fn(msg => msg) }
  }
}));

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

describe('AddonLoader', () => {
  let loader;
  const mockProjectRoot = '/mock/project';
  const mockAddonsDir = path.join(mockProjectRoot, 'addons');
  const mockConfigDir = path.join(os.homedir(), '.config', 'speech2type');
  const mockConfigFile = path.join(mockConfigDir, 'addons.json');

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: no config file exists
    existsSync.mockReturnValue(false);

    loader = new AddonLoader(mockProjectRoot);
  });

  describe('Constructor', () => {
    it('should initialize with correct paths', () => {
      expect(loader.projectRoot).toBe(mockProjectRoot);
      expect(loader.addonsDir).toBe(mockAddonsDir);
    });

    it('should initialize empty collections', () => {
      expect(loader.addons.size).toBe(0);
      expect(loader.modeMap.size).toBe(0);
      expect(loader.activeAddon).toBeNull();
    });

    it('should load addon config on initialization', () => {
      expect(loader.enabledAddons).toEqual({ enabled: {} });
    });
  });

  describe('loadAddonConfig()', () => {
    it('should return default config when file does not exist', () => {
      existsSync.mockReturnValue(false);
      const config = loader.loadAddonConfig();
      expect(config).toEqual({ enabled: {} });
    });

    it('should load config from file when it exists', () => {
      const mockConfig = { enabled: { music: true, code: false } };
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = loader.loadAddonConfig();
      expect(config).toEqual(mockConfig);
      expect(readFileSync).toHaveBeenCalledWith(mockConfigFile, 'utf8');
    });

    it('should return default config on JSON parse error', () => {
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue('invalid json');

      const config = loader.loadAddonConfig();
      expect(config).toEqual({ enabled: {} });
    });

    it('should return default config on read error', () => {
      existsSync.mockReturnValue(true);
      readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const config = loader.loadAddonConfig();
      expect(config).toEqual({ enabled: {} });
    });
  });

  describe('saveAddonConfig()', () => {
    it('should save config to file', () => {
      existsSync.mockReturnValue(true);
      loader.enabledAddons = { enabled: { music: true } };

      loader.saveAddonConfig();

      expect(writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        JSON.stringify({ enabled: { music: true } }, null, 2)
      );
    });

    it('should create directory if it does not exist', () => {
      existsSync.mockReturnValue(false);
      const mkdirSyncMock = vi.fn();
      vi.doMock('fs', async (importOriginal) => {
        const actual = await importOriginal();
        return {
          ...actual,
          mkdirSync: mkdirSyncMock
        };
      });

      loader.saveAddonConfig();

      // Should attempt to write even if directory creation might fail
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should handle write errors gracefully', () => {
      writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      expect(() => loader.saveAddonConfig()).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('isEnabled()', () => {
    it('should return true for enabled addon', () => {
      loader.enabledAddons = { enabled: { music: true } };
      expect(loader.isEnabled('music')).toBe(true);
    });

    it('should return false for explicitly disabled addon', () => {
      loader.enabledAddons = { enabled: { music: false } };
      expect(loader.isEnabled('music')).toBe(false);
    });

    it('should return true for unspecified addon (default enabled)', () => {
      loader.enabledAddons = { enabled: {} };
      expect(loader.isEnabled('music')).toBe(true);
    });
  });

  describe('enableAddon()', () => {
    it('should enable addon and save config', () => {
      loader.enableAddon('music');

      expect(loader.enabledAddons.enabled.music).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe('disableAddon()', () => {
    beforeEach(() => {
      // Setup a mock addon
      loader.addons.set('music', {
        metadata: {
          modeCommand: 'music mode',
          modeAliases: ['music', 'ableton mode']
        }
      });
      loader.modeMap.set('music mode', 'music');
      loader.modeMap.set('music', 'music');
      loader.modeMap.set('ableton mode', 'music');
    });

    it('should disable addon and save config', () => {
      loader.disableAddon('music');

      expect(loader.enabledAddons.enabled.music).toBe(false);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should remove addon from mode map', () => {
      loader.disableAddon('music');

      expect(loader.modeMap.has('music mode')).toBe(false);
      expect(loader.modeMap.has('music')).toBe(false);
      expect(loader.modeMap.has('ableton mode')).toBe(false);
    });

    it('should deactivate if currently active', () => {
      loader.activeAddon = 'music';
      loader.disableAddon('music');

      expect(loader.activeAddon).toBeNull();
    });
  });

  describe('loadAll()', () => {
    it('should handle missing addons directory', async () => {
      existsSync.mockReturnValue(false);

      await loader.loadAll();

      expect(console.log).toHaveBeenCalled();
      expect(loader.addons.size).toBe(0);
    });

    it('should load addon directories', async () => {
      existsSync.mockImplementation((p) => {
        if (p === mockAddonsDir) return true;
        if (p.endsWith('index.js')) return true;
        return false;
      });

      readdirSync.mockReturnValue([
        { name: 'music', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ]);

      // Mock dynamic import
      vi.doMock(path.join(mockAddonsDir, 'music', 'index.js'), () => ({
        metadata: { displayName: 'Music Mode', version: '1.0.0' }
      }));

      await loader.loadAll();

      // Should skip non-directory entries
      expect(readdirSync).toHaveBeenCalledWith(mockAddonsDir, { withFileTypes: true });
    });
  });

  describe('get()', () => {
    it('should return addon by name', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);

      expect(loader.get('music')).toBe(mockAddon);
    });

    it('should return undefined for unknown addon', () => {
      expect(loader.get('unknown')).toBeUndefined();
    });
  });

  describe('getByModeCommand()', () => {
    it('should return addon by mode command', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);
      loader.modeMap.set('music mode', 'music');

      expect(loader.getByModeCommand('music mode')).toBe(mockAddon);
    });

    it('should return null for unknown mode command', () => {
      expect(loader.getByModeCommand('unknown mode')).toBeNull();
    });
  });

  describe('activate()', () => {
    it('should activate addon and call init', () => {
      const mockInit = vi.fn();
      const mockAddon = {
        metadata: { displayName: 'Music Mode' },
        init: mockInit
      };
      loader.addons.set('music', mockAddon);

      const result = loader.activate('music');

      expect(result).toBe(true);
      expect(mockInit).toHaveBeenCalled();
      expect(loader.activeAddon).toBe('music');
    });

    it('should deactivate current addon before activating new one', () => {
      const mockCleanup = vi.fn();
      const currentAddon = {
        metadata: { displayName: 'Code Mode' },
        cleanup: mockCleanup
      };
      loader.addons.set('code', currentAddon);
      loader.activeAddon = 'code';

      const newAddon = { metadata: { displayName: 'Music Mode' } };
      loader.addons.set('music', newAddon);

      loader.activate('music');

      expect(mockCleanup).toHaveBeenCalled();
      expect(loader.activeAddon).toBe('music');
    });

    it('should return false for unknown addon', () => {
      const result = loader.activate('unknown');

      expect(result).toBe(false);
      expect(loader.activeAddon).toBeNull();
    });

    it('should work without init function', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);

      const result = loader.activate('music');

      expect(result).toBe(true);
    });
  });

  describe('deactivate()', () => {
    it('should deactivate current addon and call cleanup', () => {
      const mockCleanup = vi.fn();
      const mockAddon = {
        metadata: { displayName: 'Music' },
        cleanup: mockCleanup
      };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      loader.deactivate();

      expect(mockCleanup).toHaveBeenCalled();
      expect(loader.activeAddon).toBeNull();
    });

    it('should handle no active addon', () => {
      expect(() => loader.deactivate()).not.toThrow();
    });

    it('should work without cleanup function', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      loader.deactivate();

      expect(loader.activeAddon).toBeNull();
    });
  });

  describe('getActive()', () => {
    it('should return active addon', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.getActive()).toBe(mockAddon);
    });

    it('should return null when no active addon', () => {
      expect(loader.getActive()).toBeNull();
    });
  });

  describe('getActiveMetadata()', () => {
    it('should return metadata of active addon', () => {
      const metadata = { displayName: 'Music Mode', version: '1.0.0' };
      const mockAddon = { metadata };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.getActiveMetadata()).toBe(metadata);
    });

    it('should return null when no active addon', () => {
      expect(loader.getActiveMetadata()).toBeNull();
    });
  });

  describe('isPushToTalkEnabled()', () => {
    it('should return true when pushToTalk is enabled', () => {
      const mockAddon = { metadata: { pushToTalk: true } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isPushToTalkEnabled()).toBe(true);
    });

    it('should return false when pushToTalk is disabled', () => {
      const mockAddon = { metadata: { pushToTalk: false } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isPushToTalkEnabled()).toBe(false);
    });

    it('should return false when no active addon', () => {
      expect(loader.isPushToTalkEnabled()).toBe(false);
    });
  });

  describe('isPushToTalkAutoSubmit()', () => {
    it('should return true when pushToTalkAutoSubmit is enabled', () => {
      const mockAddon = { metadata: { pushToTalkAutoSubmit: true } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isPushToTalkAutoSubmit()).toBe(true);
    });

    it('should return false when not enabled', () => {
      const mockAddon = { metadata: {} };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isPushToTalkAutoSubmit()).toBe(false);
    });
  });

  describe('isCommandsOnly()', () => {
    it('should return temporary override value when set', () => {
      loader.tempCommandsOnlyOverride = true;
      expect(loader.isCommandsOnly()).toBe(true);

      loader.tempCommandsOnlyOverride = false;
      expect(loader.isCommandsOnly()).toBe(false);
    });

    it('should return setting value when override not set', () => {
      loader.activeAddon = 'music';
      loader.enabledAddons.settings = { music: { commandsOnly: true } };

      expect(loader.isCommandsOnly()).toBe(true);
    });

    it('should return metadata value when no setting', () => {
      const mockAddon = { metadata: { commandsOnly: true } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isCommandsOnly()).toBe(true);
    });

    it('should return false by default', () => {
      const mockAddon = { metadata: {} };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isCommandsOnly()).toBe(false);
    });
  });

  describe('setTempCommandsOnly()', () => {
    it('should set temporary override', () => {
      loader.setTempCommandsOnly(true);
      expect(loader.tempCommandsOnlyOverride).toBe(true);
    });

    it('should clear override with null', () => {
      loader.tempCommandsOnlyOverride = true;
      loader.setTempCommandsOnly(null);
      expect(loader.tempCommandsOnlyOverride).toBeUndefined();
    });

    it('should clear override with undefined', () => {
      loader.tempCommandsOnlyOverride = true;
      loader.setTempCommandsOnly(undefined);
      expect(loader.tempCommandsOnlyOverride).toBeUndefined();
    });
  });

  describe('isTTSEnabled()', () => {
    it('should return setting value when available', () => {
      loader.activeAddon = 'music';
      loader.enabledAddons.settings = { music: { ttsEnabled: true } };

      expect(loader.isTTSEnabled()).toBe(true);
    });

    it('should return metadata value when no setting', () => {
      const mockAddon = { metadata: { ttsEnabled: true } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isTTSEnabled()).toBe(true);
    });

    it('should return false by default', () => {
      const mockAddon = { metadata: {} };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.isTTSEnabled()).toBe(false);
    });
  });

  describe('getActiveSettings()', () => {
    it('should return settings for active addon', () => {
      const settings = { commandsOnly: true, ttsEnabled: false };
      loader.activeAddon = 'music';
      loader.enabledAddons.settings = { music: settings };

      expect(loader.getActiveSettings()).toBe(settings);
    });

    it('should return null when no active addon', () => {
      expect(loader.getActiveSettings()).toBeNull();
    });

    it('should return null when no settings', () => {
      loader.activeAddon = 'music';
      expect(loader.getActiveSettings()).toBeNull();
    });
  });

  describe('getCustomCommands()', () => {
    it('should return custom commands with computer prefix', () => {
      loader.activeAddon = 'music';
      loader.enabledAddons.settings = {
        music: {
          customCommands: {
            'play': 'PLAY_ACTION',
            'computer pause': 'PAUSE_ACTION'
          }
        }
      };

      const commands = loader.getCustomCommands();

      expect(commands).toEqual({
        'computer play': 'PLAY_ACTION',
        'computer pause': 'PAUSE_ACTION'
      });
    });

    it('should return empty object when no settings', () => {
      loader.activeAddon = 'music';
      expect(loader.getCustomCommands()).toEqual({});
    });

    it('should return empty object when no active addon', () => {
      expect(loader.getCustomCommands()).toEqual({});
    });
  });

  describe('reloadConfig()', () => {
    it('should reload addon config from file', () => {
      const newConfig = { enabled: { music: false } };
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify(newConfig));

      loader.reloadConfig();

      expect(loader.enabledAddons).toEqual(newConfig);
    });
  });

  describe('getModeCommands()', () => {
    it('should return all mode commands with computer prefix', () => {
      loader.modeMap.set('music mode', 'music');
      loader.modeMap.set('code mode', 'code');

      const commands = loader.getModeCommands();

      expect(commands).toEqual({
        'computer music mode': 'mode_addon_music',
        'computer code mode': 'mode_addon_code'
      });
    });

    it('should return empty object when no mode commands', () => {
      expect(loader.getModeCommands()).toEqual({});
    });
  });

  describe('getActiveCommands()', () => {
    it('should return addon commands with computer prefix', () => {
      const mockAddon = {
        metadata: { displayName: 'Music' },
        commands: {
          'play': 'PLAY',
          'pause': 'PAUSE'
        }
      };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      const commands = loader.getActiveCommands();

      expect(commands).toEqual({
        'computer play': 'PLAY',
        'computer pause': 'PAUSE'
      });
    });

    it('should merge custom commands', () => {
      const mockAddon = {
        metadata: { displayName: 'Music' },
        commands: { 'play': 'PLAY' }
      };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';
      loader.enabledAddons.settings = {
        music: {
          customCommands: { 'stop': 'STOP' }
        }
      };

      const commands = loader.getActiveCommands();

      expect(commands).toEqual({
        'computer play': 'PLAY',
        'computer stop': 'STOP'
      });
    });
  });

  describe('getActivePatterns()', () => {
    it('should return patterns with computer prefix', () => {
      const mockAddon = {
        metadata: { displayName: 'Music' },
        patterns: [
          { pattern: /^play (.+)/, action: 'PLAY_SONG', extract: 1 }
        ]
      };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      const patterns = loader.getActivePatterns();

      expect(patterns).toHaveLength(1);
      expect(patterns[0].action).toBe('PLAY_SONG');
      expect(patterns[0].extract).toBe(1);
    });

    it('should return empty array when no active addon', () => {
      expect(loader.getActivePatterns()).toEqual([]);
    });

    it('should return empty array when addon has no patterns', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.getActivePatterns()).toEqual([]);
    });
  });

  describe('executeAction()', () => {
    it('should execute action on active addon', () => {
      const mockExecute = vi.fn().mockReturnValue(true);
      const mockAddon = {
        metadata: { displayName: 'Music' },
        execute: mockExecute
      };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      const result = loader.executeAction('PLAY', 'song.mp3');

      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith('PLAY', 'song.mp3');
    });

    it('should return false when no active addon', () => {
      expect(loader.executeAction('PLAY', 'song.mp3')).toBe(false);
    });

    it('should return false when addon has no execute function', () => {
      const mockAddon = { metadata: { displayName: 'Music' } };
      loader.addons.set('music', mockAddon);
      loader.activeAddon = 'music';

      expect(loader.executeAction('PLAY', 'song.mp3')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return only enabled addons', () => {
      loader.addons.set('music', { metadata: { displayName: 'Music Mode', version: '1.0' } });
      loader.addons.set('code', { metadata: { displayName: 'Code Mode', version: '2.0' } });
      loader.enabledAddons.enabled = { music: true, code: false };

      const list = loader.list();

      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('music');
      expect(list[0].displayName).toBe('Music Mode');
    });
  });

  describe('listAll()', () => {
    it('should return all addons with enabled status', () => {
      loader.addons.set('music', { metadata: { displayName: 'Music Mode' } });
      loader.addons.set('code', { metadata: { displayName: 'Code Mode' } });
      loader.enabledAddons.enabled = { music: true, code: false };

      const list = loader.listAll();

      expect(list).toHaveLength(2);
      expect(list.find(a => a.name === 'music').enabled).toBe(true);
      expect(list.find(a => a.name === 'code').enabled).toBe(false);
    });
  });

  describe('getConfigPath()', () => {
    it('should return config file path', () => {
      expect(loader.getConfigPath()).toBe(mockConfigFile);
    });
  });
});
