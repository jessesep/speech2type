import { spawn, execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import readline from 'readline';

class HotkeyService extends EventEmitter {
  constructor(config) {
    super();
    this.hotkeyBin = path.join(config.projectRoot, 'bin', 'hotkey-manager');
    this.hotkeyConfig = config.data.hotkey;
    this.proc = null;
  }

  start() {
    if (this.proc) return;

    // Primary hotkey args
    const primaryMods = this.hotkeyConfig ? this.hotkeyConfig.modifiers.join('+') : 'cmd';
    const primaryKey = this.hotkeyConfig ? this.hotkeyConfig.key : ';';

    // Secondary hotkey: Cmd+' for toggle auto-read
    const secondaryMods = 'cmd';
    const secondaryKey = "'";

    const args = [primaryMods, primaryKey, secondaryMods, secondaryKey];

    this.proc = spawn(this.hotkeyBin, args, {
      stdio: ['ignore', 'pipe', process.env.DEBUG ? 'inherit' : 'ignore'],
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed === 'TRIGGERED') {
        this.emit('toggle');
      } else if (trimmed === 'TOGGLE_AUTO_READ') {
        this.emit('toggle_auto_read');
      } else if (trimmed === 'STOP_TTS') {
        this.emit('stop_tts');
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
