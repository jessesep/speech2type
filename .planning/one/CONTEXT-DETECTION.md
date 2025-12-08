# Context Detection (Phase 3.1)

> Making ONE aware of where you are and what you're doing

## Overview

Context Detection enables ONE to adapt commands based on the current environment. Instead of requiring explicit mode switches, ONE observes:
- Which app is currently focused
- Recent command history
- Active project/workspace
- Time of day patterns

This powers the "same phrase, different meaning" capability:
- "play" in Ableton = transport play
- "play" in Spotify = resume playback
- "play" in VS Code = run current file

## Existing Infrastructure

ONE already has pieces for context detection:

### Focus Checker
```bash
# Existing: build-focus-checker.sh creates native binary
./focus-checker  # Returns: "com.ableton.live" or "com.apple.Terminal"
```

This uses macOS APIs to get the frontmost app bundle ID.

### Mode System
```javascript
// Current: Manual mode switching
const modes = ['general', 'claude', 'music'];
let currentMode = 'general';
```

## Context Object Structure

```javascript
// src/services/context.js
export class ContextService {
  constructor() {
    this.current = {
      // App context
      app: {
        name: null,        // "Ableton Live 12"
        bundleId: null,    // "com.ableton.live"
        category: null,    // "daw", "browser", "terminal", "editor"
      },

      // Mode context (manual or auto)
      mode: 'general',
      modeSource: 'manual',  // 'manual' | 'auto' | 'rule'

      // Command history (last N commands)
      recentCommands: [],

      // Session context
      session: {
        startedAt: null,
        commandCount: 0,
        correctionCount: 0,
      },

      // Optional: workspace/project
      workspace: {
        path: null,
        type: null,  // 'git', 'npm', 'xcode', etc.
      }
    };
  }
}
```

## Implementation

### 1. Focus Polling Service

```javascript
// src/services/context.js
import { exec } from 'child_process';
import path from 'path';

const FOCUS_CHECKER = path.join(__dirname, '../../focus-checker');
const POLL_INTERVAL = 500;  // ms

export class ContextService {
  constructor() {
    this.current = this.createEmptyContext();
    this.listeners = new Set();
    this.pollTimer = null;
    this.appMappings = this.loadAppMappings();
  }

  async start() {
    await this.updateFocusedApp();
    this.pollTimer = setInterval(() => this.updateFocusedApp(), POLL_INTERVAL);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async updateFocusedApp() {
    try {
      const bundleId = await this.getFocusedApp();

      if (bundleId !== this.current.app.bundleId) {
        const oldApp = this.current.app.bundleId;

        this.current.app = {
          bundleId,
          name: this.getAppName(bundleId),
          category: this.getAppCategory(bundleId),
        };

        this.emit('app-changed', { from: oldApp, to: bundleId });
        await this.checkAutoModeSwitch();
      }
    } catch (e) {
      console.error('[Context] Focus check failed:', e);
    }
  }

  getFocusedApp() {
    return new Promise((resolve, reject) => {
      exec(FOCUS_CHECKER, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });
  }

  getAppName(bundleId) {
    return this.appMappings[bundleId]?.name || bundleId.split('.').pop();
  }

  getAppCategory(bundleId) {
    return this.appMappings[bundleId]?.category || 'unknown';
  }

  loadAppMappings() {
    return {
      'com.ableton.live': { name: 'Ableton Live', category: 'daw' },
      'com.apple.Terminal': { name: 'Terminal', category: 'terminal' },
      'com.microsoft.VSCode': { name: 'VS Code', category: 'editor' },
      'com.googlecode.iterm2': { name: 'iTerm', category: 'terminal' },
      'com.apple.Safari': { name: 'Safari', category: 'browser' },
      'com.google.Chrome': { name: 'Chrome', category: 'browser' },
      'com.figma.Desktop': { name: 'Figma', category: 'design' },
      'com.spotify.client': { name: 'Spotify', category: 'music' },
      'com.apple.Music': { name: 'Apple Music', category: 'music' },
      'com.slack.Slack': { name: 'Slack', category: 'communication' },
      // Add more as needed
    };
  }

  // Event system
  on(event, callback) {
    this.listeners.add({ event, callback });
  }

  emit(event, data) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        listener.callback(data);
      }
    }
  }
}
```

### 2. Command History Tracking

```javascript
// Add to ContextService

const MAX_RECENT_COMMANDS = 20;

recordCommand(command) {
  const entry = {
    action: command.action,
    phrase: command.phrase,
    app: this.current.app.bundleId,
    mode: this.current.mode,
    timestamp: Date.now(),
    success: command.success ?? true,
  };

  this.current.recentCommands.unshift(entry);

  // Keep only recent
  if (this.current.recentCommands.length > MAX_RECENT_COMMANDS) {
    this.current.recentCommands.pop();
  }

  this.current.session.commandCount++;

  if (command.wasCorrection) {
    this.current.session.correctionCount++;
  }
}

getRecentCommands(count = 5) {
  return this.current.recentCommands.slice(0, count);
}

getCommandsForApp(bundleId, count = 10) {
  return this.current.recentCommands
    .filter(c => c.app === bundleId)
    .slice(0, count);
}
```

### 3. Context-Aware Resolution

Modify IntentResolver to use context:

```javascript
// src/services/intent-resolver.js

import { contextService } from './context.js';
import { commandDictionary } from './commands.js';

async resolve(phrase) {
  const context = contextService.getContext();

  // Check context-specific overrides first
  const override = await this.checkContextOverride(phrase, context);
  if (override) return override;

  // Regular resolution with context passed to AI
  return await this.resolveWithContext(phrase, context);
}

async checkContextOverride(phrase, context) {
  const { bundleId, category } = context.app;

  // Check app-specific overrides in personal dictionary
  const overrides = commandDictionary.getContextOverrides(bundleId);

  if (overrides) {
    const normalized = phrase.toLowerCase().trim();
    if (overrides[normalized]) {
      return {
        action: overrides[normalized],
        confidence: 1.0,
        tier: 1,
        source: 'context_override',
        context: { app: bundleId }
      };
    }
  }

  return null;
}

async resolveWithContext(phrase, context) {
  // Include context in AI prompt
  const systemPrompt = `
You are a voice command interpreter for ONE.
Current context:
- Focused app: ${context.app.name} (${context.app.category})
- Mode: ${context.mode}
- Recent commands: ${context.recentCommands.slice(0, 3).map(c => c.action).join(', ')}

Interpret ambiguous commands based on context. For example:
- "play" in a DAW means transport play
- "play" in a music app means resume playback
- "run" in an editor means execute current file
`;

  // ... rest of AI call
}
```

### 4. Expose to Addons

Make context available to addons:

```javascript
// src/index.js

// When sending to addon
const addonContext = {
  app: contextService.current.app,
  mode: contextService.current.mode,
  recentCommands: contextService.getRecentCommands(3),
};

addon.handleCommand(command, addonContext);
```

## App Categories & Defaults

Define default behaviors per category:

```javascript
// src/data/context_defaults.json
{
  "categories": {
    "daw": {
      "defaultOverrides": {
        "play": "transport_play",
        "stop": "transport_stop",
        "record": "transport_record",
        "loop": "toggle_loop"
      },
      "defaultMode": "music"
    },
    "terminal": {
      "defaultOverrides": {
        "run": "execute_command",
        "clear": "clear_terminal",
        "cancel": "send_ctrl_c"
      },
      "defaultMode": "claude"
    },
    "editor": {
      "defaultOverrides": {
        "run": "run_current_file",
        "save": "save_file",
        "search": "find_in_file"
      },
      "defaultMode": "general"
    },
    "browser": {
      "defaultOverrides": {
        "refresh": "reload_page",
        "back": "navigate_back",
        "forward": "navigate_forward"
      },
      "defaultMode": "general"
    }
  }
}
```

## Configuration

### User Preferences

```json
// ~/.config/one/context_settings.json
{
  "polling_interval_ms": 500,
  "auto_mode_switch": true,
  "track_history": true,
  "max_history": 20,

  "app_modes": {
    "com.ableton.live": "music",
    "com.apple.Terminal": "claude",
    "com.googlecode.iterm2": "claude"
  },

  "disabled_apps": [
    "com.apple.loginwindow"
  ]
}
```

## Events

The context service emits events for other services to react:

| Event | Data | Use Case |
|-------|------|----------|
| `app-changed` | `{ from, to }` | Update UI, check auto-switch |
| `mode-changed` | `{ from, to, source }` | Notify user, update commands |
| `context-ready` | `{ context }` | Initial load complete |

## Integration Points

### 1. Main Index
```javascript
// src/index.js
import { contextService } from './services/context.js';

await contextService.start();

// Record each command
contextService.recordCommand({
  action: result.action,
  phrase: transcript,
  success: true
});
```

### 2. GUI Status
```javascript
// gui/main.cjs
// Show current app in tray menu
contextService.on('app-changed', ({ to }) => {
  const appName = contextService.getAppName(to);
  updateTrayTooltip(`ONE - ${appName}`);
});
```

### 3. IntentResolver
```javascript
// Already shown above - context passed to resolution
```

## Performance Considerations

- **Polling Frequency**: 500ms is a good balance. Faster = more CPU, slower = laggy context
- **History Limit**: Keep last 20 commands, not infinite
- **Lazy Loading**: Don't load app mappings until needed
- **Caching**: Cache focus checker results for rapid successive calls

## Testing

```javascript
describe('ContextService', () => {
  test('detects app changes', async () => {
    const context = new ContextService();
    const changes = [];
    context.on('app-changed', (data) => changes.push(data));

    // Simulate app switch
    await context.updateFocusedApp();
    // ... trigger switch ...

    expect(changes.length).toBeGreaterThan(0);
  });

  test('tracks command history', () => {
    const context = new ContextService();
    context.recordCommand({ action: 'test1', phrase: 'test phrase' });
    context.recordCommand({ action: 'test2', phrase: 'another test' });

    expect(context.getRecentCommands(2)).toHaveLength(2);
    expect(context.getRecentCommands(2)[0].action).toBe('test2');
  });

  test('respects max history', () => {
    const context = new ContextService();
    for (let i = 0; i < 30; i++) {
      context.recordCommand({ action: `cmd_${i}`, phrase: `phrase ${i}` });
    }

    expect(context.current.recentCommands.length).toBe(20);
  });
});
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/context.js` | CREATE |
| `src/data/context_defaults.json` | CREATE |
| `src/services/intent-resolver.js` | MODIFY |
| `src/index.js` | MODIFY |
| `gui/main.cjs` | MODIFY |

## Success Criteria

- App detection < 50ms latency
- Context updates don't block main thread
- Override lookup O(1)
- Memory usage < 5MB for history

---

*Phase 3.1 Spec by thinker | 2025-12-08*
