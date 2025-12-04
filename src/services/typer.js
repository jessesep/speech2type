import { execFile, spawn } from 'child_process';
import EventEmitter from 'events';

class TyperService extends EventEmitter {
  constructor(config) {
    super();
    this.isAsciiSafe = config.data.speech.language.includes('en');
    this.isSpeaking = false;
    this.sayProcess = null;
  }

  async typeText(text) {
    if (!text?.trim()) return;

    const usePaste = !this.isAsciiSafe;
    if (!usePaste) {
      text = this.escapeText(text);
    }

    try {
      await this.execKeystroke(text, usePaste);

      console.debug(`[typer] Typed: ${text} (${this.isAsciiSafe ? 'ascii' : 'non-ascii'})`);
      return true;
    } catch (error) {
      console.error('[typer] Error typing text:', error);
      return false;
    }
  }

  /**
   * WORKAROUND: macOS System Events drops the first keystroke using osascript.
   * Solution: Add a small delay before typing to let System Events "warm up".
   * Alternative approach that's more reliable than the type-delete-retype method.
   */
  KEYSTROKE_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    tell application "System Events"
      delay 0.05
      keystroke (item 1 of argv)
    end tell
  end run`;

  KEYSTROKE_PASTE_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    set t to item 1 of argv
    set the clipboard to t
    tell application "System Events" to keystroke "v" using {command down}
  end run`;

  execKeystroke(text, usePaste = false) {
    return new Promise((resolve, reject) => {
      execFile(
        '/usr/bin/osascript',
        ['-e', usePaste ? this.KEYSTROKE_PASTE_SCRIPT : this.KEYSTROKE_SCRIPT, text],
        { maxBuffer: 1024 * 1024 },
        (err, stdout, _stderr) => {
          if (err) {
            return reject(err);
          }
          resolve(stdout);
        }
      );
    });
  }

  /**
   * Convert arbitrary text to safe ASCII string for osascript keystroke
   * - Removes accents/diacritics
   * - Drops non-ASCII characters
   * - Normalizes whitespace
   * - Escapes for osascript string literal
   */
  escapeText(input) {
    if (!input) return '';

    // 1. Normalize and strip accents (NFD splits char + diacritic, then remove marks)
    let ascii = input.normalize('NFD').replace(/\p{M}+/gu, ''); // remove combining marks

    // 2. Drop any non-ASCII (control chars, emojis, etc.)
    ascii = ascii.replace(/[^\x20-\x7E\n\t]/g, '');

    // 3. Normalize line endings + whitespace
    ascii = ascii.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');

    // 4. Escape for osascript string literal
    return ascii.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  }

  /**
   * Reset warmup state for new session
   */
  resetWarmup() {
    this.hasWarmedUp = false;
    console.debug('[typer] Reset warmup state');
  }

  /**
   * Press the Enter/Return key
   */
  async pressEnter() {
    try {
      await this.execKeyCode(36); // Enter key
      console.debug('[typer] Pressed Enter');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing Enter:', error);
      return false;
    }
  }

  /**
   * Press the Escape key
   */
  async pressEscape() {
    try {
      await this.execKeyCode(53); // Escape key
      console.debug('[typer] Pressed Escape');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing Escape:', error);
      return false;
    }
  }

  /**
   * Insert a newline character
   */
  async insertNewline() {
    try {
      await this.execKeyCode(36, { shift: true }); // Shift+Enter for newline
      console.debug('[typer] Inserted newline');
      return true;
    } catch (error) {
      console.error('[typer] Error inserting newline:', error);
      return false;
    }
  }

  /**
   * Delete a number of characters (backspace)
   */
  BACKSPACE_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    set deleteCount to (item 1 of argv as number)
    tell application "System Events"
      repeat deleteCount times
        key code 51
      end repeat
    end tell
  end run`;

  async deleteCharacters(count) {
    if (count <= 0) return true;
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.BACKSPACE_SCRIPT, String(count)],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug(`[typer] Deleted ${count} characters`);
      return true;
    } catch (error) {
      console.error('[typer] Error deleting characters:', error);
      return false;
    }
  }

  /**
   * Clear entire input field (Cmd+A to select all, then delete)
   */
  CLEAR_ALL_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "a" using {command down}
      delay 0.05
      key code 51
    end tell
  end run`;

  async clearAll() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.CLEAR_ALL_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Cleared all text in input field');
      return true;
    } catch (error) {
      console.error('[typer] Error clearing all:', error);
      return false;
    }
  }

  /**
   * Copy selection to clipboard (Cmd+C)
   */
  COPY_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "c" using {command down}
    end tell
  end run`;

  async copy() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.COPY_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Copied to clipboard');
      return true;
    } catch (error) {
      console.error('[typer] Error copying:', error);
      return false;
    }
  }

  /**
   * Paste from clipboard (Cmd+V)
   */
  PASTE_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "v" using {command down}
    end tell
  end run`;

  async paste() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.PASTE_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Pasted from clipboard');
      return true;
    } catch (error) {
      console.error('[typer] Error pasting:', error);
      return false;
    }
  }

  /**
   * Cut selection to clipboard (Cmd+X)
   */
  CUT_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "x" using {command down}
    end tell
  end run`;

  async cut() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.CUT_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Cut to clipboard');
      return true;
    } catch (error) {
      console.error('[typer] Error cutting:', error);
      return false;
    }
  }

  /**
   * Select all (Cmd+A)
   */
  SELECT_ALL_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "a" using {command down}
    end tell
  end run`;

  async selectAll() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.SELECT_ALL_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Selected all');
      return true;
    } catch (error) {
      console.error('[typer] Error selecting all:', error);
      return false;
    }
  }

  /**
   * Save (Cmd+S)
   */
  async save() {
    return this.execShortcut('s', ['command down']);
  }

  /**
   * Find (Cmd+F)
   */
  async find() {
    return this.execShortcut('f', ['command down']);
  }

  /**
   * New Tab (Cmd+T)
   */
  async newTab() {
    return this.execShortcut('t', ['command down']);
  }

  /**
   * Close Tab (Cmd+W)
   */
  async closeTab() {
    return this.execShortcut('w', ['command down']);
  }

  /**
   * New Window (Cmd+N)
   */
  async newWindow() {
    return this.execShortcut('n', ['command down']);
  }

  /**
   * Helper to execute a keyboard shortcut with modifiers
   */
  async execShortcut(key, modifiers = []) {
    const modString = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : '';
    const script = `tell application "System Events" to keystroke "${key}"${modString}`;
    try {
      await new Promise((resolve, reject) => {
        execFile('/usr/bin/osascript', ['-e', script], { maxBuffer: 1024 * 1024 }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      console.debug(`[typer] Shortcut: ${key} with ${modifiers.join('+') || 'no modifiers'}`);
      return true;
    } catch (error) {
      console.error(`[typer] Error shortcut ${key}:`, error);
      return false;
    }
  }

  /**
   * Select current word (Option+Shift+Left then Option+Shift+Right)
   */
  SELECT_WORD_SCRIPT = `
  on run
    tell application "System Events"
      key code 123 using {option down, shift down}
      key code 124 using {option down, shift down}
    end tell
  end run`;

  async selectWord() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.SELECT_WORD_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Selected word');
      return true;
    } catch (error) {
      console.error('[typer] Error selecting word:', error);
      return false;
    }
  }

  /**
   * Select current line (Cmd+Shift+Left then Cmd+Shift+Right)
   */
  SELECT_LINE_SCRIPT = `
  on run
    tell application "System Events"
      key code 123 using {command down, shift down}
      key code 124 using {command down, shift down}
    end tell
  end run`;

  async selectLine() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.SELECT_LINE_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Selected line');
      return true;
    } catch (error) {
      console.error('[typer] Error selecting line:', error);
      return false;
    }
  }

  /**
   * Press arrow keys
   */
  async pressArrow(direction) {
    // Key codes: up=126, down=125, left=123, right=124
    const keyCodes = { up: 126, down: 125, left: 123, right: 124 };
    const keyCode = keyCodes[direction];
    if (!keyCode) return false;
    try {
      await this.execKeyCode(keyCode);
      console.debug(`[typer] Pressed arrow ${direction}`);
      return true;
    } catch (error) {
      console.error(`[typer] Error pressing arrow ${direction}:`, error);
      return false;
    }
  }

  /**
   * Press Home (Cmd+Left)
   */
  HOME_SCRIPT = `
  on run
    tell application "System Events"
      key code 123 using {command down}
    end tell
  end run`;

  async pressHome() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.HOME_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Pressed Home');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing Home:', error);
      return false;
    }
  }

  /**
   * Press End (Cmd+Right)
   */
  END_SCRIPT = `
  on run
    tell application "System Events"
      key code 124 using {command down}
    end tell
  end run`;

  async pressEnd() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.END_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] Pressed End');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing End:', error);
      return false;
    }
  }

  /**
   * System Undo (Cmd+Z)
   */
  UNDO_SYSTEM_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "z" using {command down}
    end tell
  end run`;

  async undoSystem() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.UNDO_SYSTEM_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] System undo');
      return true;
    } catch (error) {
      console.error('[typer] Error system undo:', error);
      return false;
    }
  }

  /**
   * System Redo (Cmd+Shift+Z)
   */
  REDO_SYSTEM_SCRIPT = `
  on run
    tell application "System Events"
      keystroke "z" using {command down, shift down}
    end tell
  end run`;

  async redoSystem() {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.REDO_SYSTEM_SCRIPT],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      console.debug('[typer] System redo');
      return true;
    } catch (error) {
      console.error('[typer] Error system redo:', error);
      return false;
    }
  }

  /**
   * Press Delete (forward delete)
   */
  async pressDelete() {
    try {
      await this.execKeyCode(117); // Forward delete key code
      console.debug('[typer] Pressed Delete');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing Delete:', error);
      return false;
    }
  }

  /**
   * Press Tab
   */
  async pressTab() {
    try {
      await this.execKeyCode(48); // Tab key code
      console.debug('[typer] Pressed Tab');
      return true;
    } catch (error) {
      console.error('[typer] Error pressing Tab:', error);
      return false;
    }
  }

  /**
   * Execute a key code via AppleScript
   */
  KEYCODE_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    tell application "System Events"
      key code (item 1 of argv as number)
    end tell
  end run`;

  KEYCODE_SHIFT_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    tell application "System Events"
      key code (item 1 of argv as number) using {shift down}
    end tell
  end run`;

  execKeyCode(keyCode, options = {}) {
    const script = options.shift ? this.KEYCODE_SHIFT_SCRIPT : this.KEYCODE_SCRIPT;
    return new Promise((resolve, reject) => {
      execFile(
        '/usr/bin/osascript',
        ['-e', script, String(keyCode)],
        { maxBuffer: 1024 * 1024 },
        (err, stdout, _stderr) => {
          if (err) {
            return reject(err);
          }
          resolve(stdout);
        }
      );
    });
  }

  /**
   * Focus/activate an application by name
   */
  FOCUS_APP_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    set appName to item 1 of argv
    tell application appName to activate
  end run`;

  async focusApp(appName) {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.FOCUS_APP_SCRIPT, appName],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug(`[typer] Focused app: ${appName}`);
      return true;
    } catch (error) {
      console.error(`[typer] Error focusing app ${appName}:`, error);
      return false;
    }
  }

  /**
   * Get list of running applications
   */
  async getRunningApps() {
    try {
      const result = await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', 'tell application "System Events" to get name of every process whose background only is false'],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      return result.trim().split(', ');
    } catch (error) {
      console.error('[typer] Error getting running apps:', error);
      return [];
    }
  }

  /**
   * Switch to a specific Terminal window by index (1-based)
   */
  TERMINAL_WINDOW_INDEX_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    set windowIndex to (item 1 of argv as number)
    tell application "Terminal"
      activate
      if windowIndex ≤ (count of windows) then
        set index of window windowIndex to 1
      end if
    end tell
  end run`;

  async focusTerminalWindow(windowIndex) {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.TERMINAL_WINDOW_INDEX_SCRIPT, String(windowIndex)],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug(`[typer] Focused Terminal window ${windowIndex}`);
      return true;
    } catch (error) {
      console.error(`[typer] Error focusing Terminal window ${windowIndex}:`, error);
      return false;
    }
  }

  /**
   * Switch to a Terminal window by name/keyword search
   */
  TERMINAL_WINDOW_NAME_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    set searchTerm to item 1 of argv
    tell application "Terminal"
      activate
      set theWindows to every window whose name contains searchTerm
      if (count of theWindows) > 0 then
        set index of item 1 of theWindows to 1
      end if
    end tell
  end run`;

  async focusTerminalByName(searchTerm) {
    try {
      await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', this.TERMINAL_WINDOW_NAME_SCRIPT, searchTerm],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      console.debug(`[typer] Focused Terminal window containing "${searchTerm}"`);
      return true;
    } catch (error) {
      console.error(`[typer] Error focusing Terminal by name "${searchTerm}":`, error);
      return false;
    }
  }

  /**
   * Get list of Terminal window names
   */
  async getTerminalWindows() {
    try {
      const result = await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/osascript',
          ['-e', 'tell application "Terminal" to get name of every window'],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });
      return result.trim().split(', ');
    } catch (error) {
      console.error('[typer] Error getting Terminal windows:', error);
      return [];
    }
  }

  /**
   * Speak text aloud using macOS text-to-speech
   * Emits 'speaking_start' and 'speaking_end' events
   * @param {string} text - Text to speak
   * @param {string} voice - Voice name (default: Samantha)
   * @param {number} rate - Speech rate in words per minute (default: 220)
   */
  async speak(text, voice = 'Samantha', rate = 220) {
    if (!text?.trim()) return true;

    try {
      this.isSpeaking = true;
      this.emit('speaking_start');

      await new Promise((resolve, reject) => {
        this.sayProcess = spawn('/usr/bin/say', ['-v', voice, '-r', String(rate), text]);

        this.sayProcess.on('close', (code) => {
          this.sayProcess = null;
          resolve(code);
        });

        this.sayProcess.on('error', (err) => {
          this.sayProcess = null;
          reject(err);
        });
      });

      console.debug(`[typer] Spoke: "${text.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      console.error('[typer] Error speaking text:', error);
      return false;
    } finally {
      this.isSpeaking = false;
      this.emit('speaking_end');
    }
  }

  /**
   * Stop any ongoing speech
   */
  async stopSpeaking() {
    try {
      if (this.sayProcess) {
        this.sayProcess.kill();
        this.sayProcess = null;
      }
      // Kill any say processes (macOS TTS)
      await new Promise((resolve) => {
        execFile('/usr/bin/killall', ['say'], { maxBuffer: 1024 * 1024 }, () => resolve());
      });
      // Kill any afplay processes (Piper TTS playback)
      await new Promise((resolve) => {
        execFile('/usr/bin/killall', ['afplay'], { maxBuffer: 1024 * 1024 }, () => resolve());
      });
      // Kill any piper processes
      await new Promise((resolve) => {
        execFile('/usr/bin/killall', ['piper'], { maxBuffer: 1024 * 1024 }, () => resolve());
      });
      // Remove the TTS lock file
      const fs = await import('fs');
      try {
        fs.unlinkSync('/tmp/claude-tts-speaking');
      } catch (e) {
        // Ignore if file doesn't exist
      }
      this.isSpeaking = false;
      this.emit('speaking_end');
      console.debug('[typer] Stopped speaking');
      return true;
    } catch (error) {
      return true; // Ignore errors
    }
  }

  /**
   * Read clipboard contents aloud
   */
  async speakClipboard(voice = 'Samantha', rate = 200) {
    try {
      const clipboardText = await new Promise((resolve, reject) => {
        execFile(
          '/usr/bin/pbpaste',
          [],
          { maxBuffer: 1024 * 1024 },
          (err, stdout, _stderr) => {
            if (err) {
              return reject(err);
            }
            resolve(stdout);
          }
        );
      });

      if (clipboardText?.trim()) {
        console.debug(`[typer] Speaking clipboard: "${clipboardText.substring(0, 50)}..."`);
        return await this.speak(clipboardText, voice, rate);
      } else {
        console.debug('[typer] Clipboard is empty');
        return false;
      }
    } catch (error) {
      console.error('[typer] Error reading clipboard:', error);
      return false;
    }
  }
}

export { TyperService };
