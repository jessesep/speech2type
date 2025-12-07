import { spawn, execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import readline from 'readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import os from 'os';

// Default hotkey configuration
// macOS keycodes: ; = 41, ' = 39 (on US keyboard), Space = 49
const DEFAULT_HOTKEYS = {
  toggle: { modifiers: ['cmd'], key: ';', description: 'Toggle listening' },
  toggleTTS: { modifiers: ['ctrl'], key: "'", description: "Toggle TTS (Ctrl+')" },  // Use character, not keycode
  pushToTalk: { modifiers: ['cmd', 'alt'], key: null, description: 'Push-to-talk (hold)' },
  stopTTS: { modifiers: [], key: '49', description: 'Stop TTS (Spacebar)' },  // keycode 49 = space
};

const HOTKEY_CONFIG_FILE = path.join(os.homedir(), '.config', 'speech2type', 'hotkeys.json');

class HotkeyService extends EventEmitter {
  constructor(config) {
    super();
    this.hotkeyBin = path.join(config.projectRoot, 'bin', 'hotkey-manager');
    this.hotkeyConfig = config.data.hotkey;
    this.hotkeys = this.loadHotkeyConfig();
    this.proc = null;
  }

  /**
   * Load hotkey configuration from file
   */
  loadHotkeyConfig() {
    try {
      if (existsSync(HOTKEY_CONFIG_FILE)) {
        const data = readFileSync(HOTKEY_CONFIG_FILE, 'utf8');
        return { ...DEFAULT_HOTKEYS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('[hotkey] Failed to load config:', e.message);
    }
    return { ...DEFAULT_HOTKEYS };
  }

  /**
   * Save hotkey configuration to file
   */
  saveHotkeyConfig() {
    try {
      const configDir = path.dirname(HOTKEY_CONFIG_FILE);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      writeFileSync(HOTKEY_CONFIG_FILE, JSON.stringify(this.hotkeys, null, 2));
    } catch (e) {
      console.error('[hotkey] Failed to save config:', e.message);
    }
  }

  /**
   * Get all hotkeys
   */
  getHotkeys() {
    return this.hotkeys;
  }

  /**
   * Update a hotkey
   */
  setHotkey(name, config) {
    this.hotkeys[name] = { ...this.hotkeys[name], ...config };
    this.saveHotkeyConfig();
  }

  /**
   * Format hotkey for display
   */
  static formatHotkey(hotkey) {
    if (!hotkey) return 'Not set';
    const mods = hotkey.modifiers || [];
    const key = hotkey.key || '';
    const modStr = mods.map(m => {
      if (m === 'cmd') return 'Cmd';
      if (m === 'alt') return 'Option';
      if (m === 'ctrl') return 'Ctrl';
      if (m === 'shift') return 'Shift';
      return m;
    }).join('+');

    // Convert keycode to display name
    let keyDisplay = key;
    if (key === '39') keyDisplay = "'";
    else if (key === '49') keyDisplay = 'Space';
    else if (key === '41') keyDisplay = ';';

    return modStr ? `${modStr}+${keyDisplay}` : keyDisplay;
  }

  start() {
    if (this.proc) return;

    // Reload config to get latest from file
    this.hotkeys = this.loadHotkeyConfig();

    // Primary hotkey - toggle listening
    const toggleHotkey = this.hotkeys.toggle;
    const primaryMods = toggleHotkey.modifiers.join('+');
    const primaryKey = toggleHotkey.key;

    // Secondary hotkey - TTS toggle
    const ttsHotkey = this.hotkeys.toggleTTS;
    const secondaryMods = ttsHotkey.modifiers.join('+');
    const secondaryKey = ttsHotkey.key;

    // Note: Push-to-talk (Cmd+Option) and Stop TTS (Space) are hardcoded in Swift for now
    // The Swift binary only accepts 4 args (primary + secondary hotkey)

    const args = [primaryMods, primaryKey, secondaryMods, secondaryKey];
    console.log('[hotkey] Starting with args:', args.join(' '));

    this.proc = spawn(this.hotkeyBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Log stderr output from Swift binary
    this.proc.stderr.on('data', (data) => {
      console.log('[hotkey]', data.toString().trim());
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      console.log('[hotkey] Event:', trimmed);

      if (trimmed === 'TRIGGERED') {
        this.emit('toggle');
      } else if (trimmed === 'TOGGLE_AUTO_READ') {
        this.emit('toggle_auto_read');
      } else if (trimmed === 'STOP_TTS') {
        this.emit('stop_tts');
      } else if (trimmed === 'PUSH_TO_TALK_START') {
        this.emit('push_to_talk_start');
      } else if (trimmed === 'PUSH_TO_TALK_END') {
        this.emit('push_to_talk_end');
      } else if (trimmed === 'CTRL_TAP') {
        this.emit('ctrl_tap');
      }
    });

    this.proc.on('exit', (code) => {
      console.debug('[hotkey] Hotkey manager exited with code:', code);
      this.proc = null;
    });
  }

  stop() {
    if (this.proc) {
      process.kill(this.proc.pid, 'SIGTERM');
      this.proc = null;
    }
  }

  capture(timeoutMs = 30_000) {
    const stdout = execFileSync(this.hotkeyBin, ['--capture'], {
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', process.env.DEBUG ? 'inherit' : 'ignore'],
    });
    return JSON.parse(stdout.toString());
  }
}

export { HotkeyService };
