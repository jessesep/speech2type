/**
 * Intent Resolver Service
 *
 * Uses Claude to interpret natural speech into structured actions.
 * Supports two modes:
 *   1. Direct API (requires ANTHROPIC_API_KEY) - faster, billed separately
 *   2. Claude CLI (uses your Claude Code login) - uses existing auth
 *
 * Cost with API: ~$0.00005 per call (Haiku pricing)
 * Cost with CLI: Uses your Claude Code subscription/credits
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';

// Core actions the system can perform
const CORE_ACTIONS = {
  // Text submission
  ENTER: 'enter',

  // Undo/delete
  UNDO: 'undo',
  CLEAR_ALL: 'clear_all',

  // Clipboard
  COPY: 'copy',
  PASTE: 'paste',
  CUT: 'cut',
  SELECT_ALL: 'select_all',

  // Navigation
  SCROLL_UP: 'scroll_up',
  SCROLL_DOWN: 'scroll_down',
  PAGE_UP: 'page_up',
  PAGE_DOWN: 'page_down',

  // App control
  FOCUS_APP: 'focus_app',
  NEW_TAB: 'new_tab',
  CLOSE_TAB: 'close_tab',

  // System
  VOLUME_UP: 'volume_up',
  VOLUME_DOWN: 'volume_down',
  MUTE: 'mute',

  // Speech2Type specific
  STOP_LISTENING: 'stop_listening',
  START_LISTENING: 'start_listening',
  MODE_GENERAL: 'mode_general',
  MODE_CLAUDE: 'mode_claude',
  MODE_MUSIC: 'mode_music',
  TTS_ON: 'tts_on',
  TTS_OFF: 'tts_off',
  SMART_MODE_ON: 'smart_mode_on',
  SMART_MODE_OFF: 'smart_mode_off',

  // No action / just text
  NONE: 'none',
  UNKNOWN: 'unknown'
};

const SYSTEM_PROMPT = `You are a voice command interpreter for a macOS speech-to-text app. Your job is to understand what action the user wants to perform based on their natural speech.

IMPORTANT: Be concise. Return ONLY valid JSON, no explanation.

Available actions:
- enter: Submit/send/confirm (e.g., "send it", "go ahead", "submit", "done")
- undo: Undo last action (e.g., "take that back", "oops", "undo that")
- clear_all: Clear everything (e.g., "start over", "clear it", "delete all")
- copy: Copy selection (e.g., "copy that", "grab this")
- paste: Paste clipboard (e.g., "paste it", "put it here")
- cut: Cut selection (e.g., "cut that", "move this")
- select_all: Select all text (e.g., "select everything", "highlight all")
- scroll_up/scroll_down: Scroll (e.g., "go up", "scroll down a bit")
- page_up/page_down: Page navigation (e.g., "next page", "previous page")
- focus_app: Switch to app (e.g., "open chrome", "go to terminal") - include app name in "target"
- new_tab: New browser/app tab (e.g., "new tab", "open tab")
- close_tab: Close current tab (e.g., "close this", "close tab")
- volume_up/volume_down/mute: Volume control
- stop_listening: Stop voice input (e.g., "stop", "quiet", "shut up")
- start_listening: Resume voice input (e.g., "listen", "wake up")
- mode_general/mode_claude/mode_music: Switch modes
- tts_on/tts_off: Toggle text-to-speech
- smart_mode_on/smart_mode_off: Toggle smart mode
- none: User is dictating text, not giving a command
- unknown: Can't determine intent

Response format:
{"action": "action_name", "confidence": 0.0-1.0, "target": "optional target"}

Examples:
User: "send it" → {"action": "enter", "confidence": 0.95}
User: "go to safari" → {"action": "focus_app", "confidence": 0.9, "target": "safari"}
User: "I need to write an email" → {"action": "none", "confidence": 0.85}
User: "blargblarg" → {"action": "unknown", "confidence": 0.1}`;

/**
 * IntentResolver using direct Anthropic API
 * Requires: ANTHROPIC_API_KEY environment variable or passed apiKey
 */
class IntentResolver {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Anthropic API key required for IntentResolver. Use IntentResolverCLI for Claude Code auth.');
    }
    this.client = new Anthropic({ apiKey });
    this.mode = 'api';
    this._initCommon();
  }

  _initCommon() {
    this.cache = new Map();
    this.cacheMaxSize = 100;
    this.stats = {
      calls: 0,
      cacheHits: 0,
      errors: 0,
      totalLatency: 0
    };
  }

  /**
   * Resolve user speech to an action
   * @param {string} speech - The transcribed user speech
   * @param {object} context - Optional context (app name, mode, etc.)
   * @returns {Promise<{action: string, confidence: number, target?: string}>}
   */
  async resolve(speech, context = {}) {
    const normalizedSpeech = speech.toLowerCase().trim();

    // Check cache first
    const cacheKey = this._getCacheKey(normalizedSpeech, context);
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    const startTime = Date.now();
    this.stats.calls++;

    try {
      const contextHint = context.appName
        ? `\nContext: User is in ${context.appName}`
        : '';

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `${contextHint}\nUser said: "${speech}"`
          }
        ],
        system: SYSTEM_PROMPT
      });

      const latency = Date.now() - startTime;
      this.stats.totalLatency += latency;

      // Parse response
      const text = response.content[0]?.text || '{}';
      const result = this._parseResponse(text);

      // Validate and normalize result
      const normalized = {
        action: CORE_ACTIONS[result.action?.toUpperCase()] || result.action || 'unknown',
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        target: result.target || null,
        latencyMs: latency,
        mode: this.mode
      };

      // Cache result
      this._addToCache(cacheKey, normalized);

      return normalized;

    } catch (error) {
      this.stats.errors++;
      console.error('[intent-resolver] Error:', error.message);

      return {
        action: 'unknown',
        confidence: 0,
        error: error.message,
        mode: this.mode
      };
    }
  }

  _parseResponse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { action: 'unknown', confidence: 0 };
    }
  }

  /**
   * Quick check if speech looks like a command (heuristic, no API call)
   * @param {string} speech
   * @returns {boolean}
   */
  looksLikeCommand(speech) {
    const lower = speech.toLowerCase().trim();

    // Short phrases are more likely commands
    if (lower.split(' ').length <= 4) {
      // Check for command-like patterns
      const commandPatterns = [
        /^(go|open|switch|focus|close|new|stop|start|send|submit|undo|clear|copy|paste|cut|select|scroll|mute|volume)/,
        /^(do|make|set|turn|toggle|enable|disable)/,
        /(please|now|it|this|that)$/,
        /^(okay|ok|hey|hi|yo)\s/
      ];

      return commandPatterns.some(p => p.test(lower));
    }

    return false;
  }

  /**
   * Get resolver statistics
   */
  getStats() {
    return {
      ...this.stats,
      mode: this.mode,
      cacheSize: this.cache.size,
      avgLatencyMs: this.stats.calls > 0
        ? Math.round(this.stats.totalLatency / this.stats.calls)
        : 0,
      cacheHitRate: this.stats.calls > 0
        ? Math.round((this.stats.cacheHits / (this.stats.calls + this.stats.cacheHits)) * 100)
        : 0
    };
  }

  _getCacheKey(speech, context) {
    return `${speech}|${context.appName || ''}`;
  }

  _addToCache(key, value) {
    // Simple LRU: remove oldest if at capacity
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

/**
 * IntentResolver using Claude CLI (claude command)
 * Uses your existing Claude Code authentication - no API key needed
 */
class IntentResolverCLI {
  constructor() {
    this.mode = 'cli';
    this.cache = new Map();
    this.cacheMaxSize = 100;
    this.stats = {
      calls: 0,
      cacheHits: 0,
      errors: 0,
      totalLatency: 0
    };
  }

  /**
   * Resolve user speech to an action using Claude CLI
   * @param {string} speech - The transcribed user speech
   * @param {object} context - Optional context (app name, mode, etc.)
   * @returns {Promise<{action: string, confidence: number, target?: string}>}
   */
  async resolve(speech, context = {}) {
    const normalizedSpeech = speech.toLowerCase().trim();

    // Check cache first
    const cacheKey = this._getCacheKey(normalizedSpeech, context);
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    const startTime = Date.now();
    this.stats.calls++;

    try {
      const contextHint = context.appName
        ? `Context: User is in ${context.appName}. `
        : '';

      const userMessage = `${contextHint}User said: "${speech}"`;

      const response = await this._runClaude(userMessage);
      const latency = Date.now() - startTime;
      this.stats.totalLatency += latency;

      // Parse response
      const result = this._parseResponse(response);

      // Validate and normalize result
      const normalized = {
        action: CORE_ACTIONS[result.action?.toUpperCase()] || result.action || 'unknown',
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        target: result.target || null,
        latencyMs: latency,
        mode: this.mode
      };

      // Cache result
      this._addToCache(cacheKey, normalized);

      return normalized;

    } catch (error) {
      this.stats.errors++;
      console.error('[intent-resolver-cli] Error:', error.message);

      return {
        action: 'unknown',
        confidence: 0,
        error: error.message,
        mode: this.mode
      };
    }
  }

  /**
   * Run claude CLI with a prompt
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  _runClaude(userMessage) {
    return new Promise((resolve, reject) => {
      // Use claude CLI in print mode with system prompt
      const args = [
        '-p', userMessage,
        '--system-prompt', SYSTEM_PROMPT,
        '--model', 'haiku',
        '--output-format', 'text'
      ];

      const claude = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Claude CLI exited with code ${code}`));
        }
      });

      claude.on('error', (err) => {
        reject(new Error(`Failed to run claude CLI: ${err.message}`));
      });
    });
  }

  _parseResponse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // ignore
        }
      }
      return { action: 'unknown', confidence: 0 };
    }
  }

  looksLikeCommand(speech) {
    const lower = speech.toLowerCase().trim();
    if (lower.split(' ').length <= 4) {
      const commandPatterns = [
        /^(go|open|switch|focus|close|new|stop|start|send|submit|undo|clear|copy|paste|cut|select|scroll|mute|volume)/,
        /^(do|make|set|turn|toggle|enable|disable)/,
        /(please|now|it|this|that)$/,
        /^(okay|ok|hey|hi|yo)\s/
      ];
      return commandPatterns.some(p => p.test(lower));
    }
    return false;
  }

  getStats() {
    return {
      ...this.stats,
      mode: this.mode,
      cacheSize: this.cache.size,
      avgLatencyMs: this.stats.calls > 0
        ? Math.round(this.stats.totalLatency / this.stats.calls)
        : 0,
      cacheHitRate: this.stats.calls > 0
        ? Math.round((this.stats.cacheHits / (this.stats.calls + this.stats.cacheHits)) * 100)
        : 0
    };
  }

  _getCacheKey(speech, context) {
    return `${speech}|${context.appName || ''}`;
  }

  _addToCache(key, value) {
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

/**
 * Factory function to create the appropriate resolver
 * @param {object} options
 * @param {string} options.apiKey - Anthropic API key (optional)
 * @param {string} options.mode - 'api' or 'cli' (default: auto-detect)
 * @returns {IntentResolver|IntentResolverCLI}
 */
function createIntentResolver(options = {}) {
  const { apiKey, mode } = options;

  // Explicit mode selection
  if (mode === 'cli') {
    return new IntentResolverCLI();
  }

  if (mode === 'api') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('API mode requires ANTHROPIC_API_KEY environment variable or apiKey option');
    }
    return new IntentResolver(key);
  }

  // Auto-detect: prefer API if key available, otherwise CLI
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (key) {
    return new IntentResolver(key);
  }

  // Fall back to CLI
  return new IntentResolverCLI();
}

// Export everything
export {
  IntentResolver,
  IntentResolverCLI,
  createIntentResolver,
  CORE_ACTIONS
};

export default createIntentResolver;
