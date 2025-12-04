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
}

export { TyperService };
