import { execFile } from 'child_process';

class TyperService {
  constructor(config) {
    this.isAsciiSafe = config.data.speech.language.includes('en');
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
   * Solution: Type first character, delete it (backspace), then type full text.
   * This activates System Events within the same execution context without side effects.
   */
  KEYSTROKE_SCRIPT = `
  on run argv
    if (count of argv) is 0 then error number -50
    tell application "System Events"
      keystroke (character 1 of (item 1 of argv))
      key code 51
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
}

export { TyperService };
