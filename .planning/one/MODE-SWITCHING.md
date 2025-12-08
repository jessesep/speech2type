# Automatic Mode Switching (Phase 3.3)

> ONE automatically adapts to your workflow

## Overview

Mode Switching lets ONE automatically change modes based on context, eliminating the need to manually switch between "general", "music", and "claude" modes. When you switch to Ableton, ONE knows you want music commands. When you're in Terminal, it knows you might want Claude.

**Current State:**
```
User: "Computer music mode"   <- Manual
ONE: "Music mode activated"
```

**Goal State:**
```
*User switches to Ableton*
ONE: *quietly switches to music mode*
User: "Record"
ONE: *triggers transport record* <- No mode switch needed
```

## Mode Types

### Existing Modes (from src/index.js)
```javascript
const MODES = {
  general: 'General dictation and commands',
  music: 'Music production (DAW control)',
  claude: 'AI conversation mode',
};
```

### Extended Modes (Phase 3)
```javascript
const MODES = {
  general: {
    description: 'General dictation and commands',
    default: true
  },
  music: {
    description: 'Music production (DAW control)',
    categories: ['daw', 'music'],
    apps: ['com.ableton.live', 'com.native-instruments.Maschine']
  },
  claude: {
    description: 'AI conversation mode',
    categories: ['terminal'],
    apps: ['com.apple.Terminal', 'com.googlecode.iterm2']
  },
  code: {
    description: 'Programming and development',
    categories: ['editor'],
    apps: ['com.microsoft.VSCode', 'com.jetbrains.intellij']
  },
  design: {
    description: 'Design and creative',
    categories: ['design'],
    apps: ['com.figma.Desktop', 'com.adobe.Photoshop']
  }
};
```

## Auto-Switch Rules

### Default Rules (Built-in)

```json
// src/data/mode_rules.json
{
  "rules": [
    {
      "id": "daw-music-mode",
      "trigger": { "category": "daw" },
      "action": { "mode": "music" },
      "priority": 10,
      "enabled": true
    },
    {
      "id": "terminal-claude-mode",
      "trigger": { "bundleId": "com.apple.Terminal" },
      "action": { "mode": "claude" },
      "priority": 10,
      "enabled": true
    },
    {
      "id": "iterm-claude-mode",
      "trigger": { "bundleId": "com.googlecode.iterm2" },
      "action": { "mode": "claude" },
      "priority": 10,
      "enabled": true
    },
    {
      "id": "editor-general-mode",
      "trigger": { "category": "editor" },
      "action": { "mode": "general" },
      "priority": 5,
      "enabled": true
    }
  ],

  "settings": {
    "auto_switch_enabled": true,
    "notify_on_switch": true,
    "switch_delay_ms": 500,
    "revert_on_return": true
  }
}
```

### User Custom Rules

```json
// ~/.config/one/mode_settings.json (user)
{
  "rules": [
    {
      "id": "user-figma-design",
      "trigger": { "bundleId": "com.figma.Desktop" },
      "action": { "mode": "design" },
      "priority": 15
    }
  ],

  "overrides": {
    "terminal-claude-mode": { "enabled": false }
  },

  "settings": {
    "auto_switch_enabled": true,
    "notify_on_switch": false
  }
}
```

## Implementation

### 1. Mode Switcher Service

```javascript
// src/services/mode-switcher.js
import { contextService } from './context.js';
import { EventEmitter } from 'events';

export class ModeSwitcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentMode = 'general';
    this.previousMode = null;
    this.modeStack = [];  // For revert_on_return
    this.rules = [];
    this.settings = {
      auto_switch_enabled: true,
      notify_on_switch: true,
      switch_delay_ms: 500,
      revert_on_return: true,
      ...options
    };
    this.switchTimeout = null;
  }

  async init() {
    await this.loadRules();
    this.setupContextListener();
  }

  async loadRules() {
    // Load default rules
    const defaultRules = await this.loadDefaultRules();

    // Load user rules and overrides
    const userConfig = await this.loadUserConfig();

    // Merge: user rules + enabled defaults
    this.rules = [
      ...userConfig.rules,
      ...defaultRules.filter(rule =>
        !userConfig.overrides?.[rule.id]?.enabled === false
      )
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    Object.assign(this.settings, userConfig.settings);
  }

  setupContextListener() {
    contextService.on('app-changed', (data) => {
      this.handleAppChange(data);
    });
  }

  handleAppChange({ from, to }) {
    if (!this.settings.auto_switch_enabled) return;

    // Debounce rapid app switches
    if (this.switchTimeout) {
      clearTimeout(this.switchTimeout);
    }

    this.switchTimeout = setTimeout(() => {
      this.evaluateRules(to);
    }, this.settings.switch_delay_ms);
  }

  evaluateRules(bundleId) {
    const context = contextService.getContext();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (this.matchesTrigger(rule.trigger, context)) {
        this.applyAction(rule.action, rule.id);
        return;
      }
    }

    // No rule matched - revert to general if configured
    if (this.currentMode !== 'general') {
      this.setMode('general', 'no_match');
    }
  }

  matchesTrigger(trigger, context) {
    const { app } = context;

    if (trigger.bundleId && app.bundleId !== trigger.bundleId) {
      return false;
    }

    if (trigger.category && app.category !== trigger.category) {
      return false;
    }

    if (trigger.mode && this.currentMode !== trigger.mode) {
      return false;
    }

    if (trigger.url && !this.matchUrl(app.url, trigger.url)) {
      return false;
    }

    return true;
  }

  applyAction(action, ruleId) {
    if (action.mode && action.mode !== this.currentMode) {
      this.setMode(action.mode, ruleId);
    }
  }

  setMode(newMode, source = 'manual') {
    if (newMode === this.currentMode) return;

    this.previousMode = this.currentMode;
    this.currentMode = newMode;

    // Track mode stack for revert
    if (this.settings.revert_on_return && source !== 'manual') {
      this.modeStack.push({
        mode: this.previousMode,
        app: contextService.current.app.bundleId
      });
    }

    this.emit('mode-changed', {
      from: this.previousMode,
      to: newMode,
      source,
      timestamp: Date.now()
    });

    if (this.settings.notify_on_switch && source !== 'manual') {
      this.notifyModeChange(newMode);
    }
  }

  async notifyModeChange(mode) {
    // Subtle audio cue
    const soundMap = {
      music: 'mode-music.wav',
      claude: 'mode-claude.wav',
      code: 'mode-code.wav',
      general: 'mode-general.wav'
    };

    // Play sound if available
    // await playSound(soundMap[mode]);

    // Or update tray tooltip
    this.emit('notify', {
      type: 'mode-switch',
      mode,
      message: `${this.getModeDisplayName(mode)} mode`
    });
  }

  getModeDisplayName(mode) {
    const names = {
      general: 'General',
      music: 'Music',
      claude: 'Claude',
      code: 'Code',
      design: 'Design'
    };
    return names[mode] || mode;
  }

  // Manual override
  forceMode(mode) {
    this.setMode(mode, 'manual');
    // Disable auto-switch temporarily
    this.temporarilyDisableAuto(30000); // 30 seconds
  }

  temporarilyDisableAuto(duration) {
    const wasEnabled = this.settings.auto_switch_enabled;
    this.settings.auto_switch_enabled = false;

    setTimeout(() => {
      this.settings.auto_switch_enabled = wasEnabled;
      this.emit('auto-switch-restored');
    }, duration);
  }

  getMode() {
    return this.currentMode;
  }

  async loadDefaultRules() {
    // Built-in rules from src/data/mode_rules.json
    return [
      { id: 'daw-music', trigger: { category: 'daw' }, action: { mode: 'music' }, priority: 10, enabled: true },
      { id: 'terminal-claude', trigger: { bundleId: 'com.apple.Terminal' }, action: { mode: 'claude' }, priority: 10, enabled: true },
      { id: 'iterm-claude', trigger: { bundleId: 'com.googlecode.iterm2' }, action: { mode: 'claude' }, priority: 10, enabled: true },
    ];
  }

  async loadUserConfig() {
    // Load from ~/.config/one/mode_settings.json
    return { rules: [], overrides: {}, settings: {} };
  }
}

export const modeSwitcher = new ModeSwitcher();
```

### 2. Integration with Main App

```javascript
// src/index.js
import { modeSwitcher } from './services/mode-switcher.js';
import { contextService } from './services/context.js';

async function init() {
  // Start context detection
  await contextService.start();

  // Start mode switching
  await modeSwitcher.init();

  // Listen for mode changes
  modeSwitcher.on('mode-changed', ({ from, to, source }) => {
    console.log(`[Mode] ${from} → ${to} (${source})`);
    currentMode = to;  // Update global mode

    // Notify GUI
    notifyGUI('mode-changed', { mode: to });
  });
}
```

### 3. GUI Integration

```javascript
// gui/main.cjs
ipcMain.on('get-mode', (event) => {
  event.reply('mode-status', {
    current: modeSwitcher.getMode(),
    autoEnabled: modeSwitcher.settings.auto_switch_enabled
  });
});

ipcMain.on('set-mode', (event, mode) => {
  modeSwitcher.forceMode(mode);
});

ipcMain.on('toggle-auto-mode', (event, enabled) => {
  modeSwitcher.settings.auto_switch_enabled = enabled;
});
```

## Mode Indicator UI

### Tray Icon

```javascript
// Different colors per mode
const modeColors = {
  general: [100, 200, 100, 255],  // Green
  music: [200, 100, 200, 255],    // Purple
  claude: [100, 150, 255, 255],   // Blue
  code: [255, 200, 100, 255],     // Orange
  design: [255, 100, 150, 255],   // Pink
};

// Update tray on mode change
modeSwitcher.on('mode-changed', ({ to }) => {
  updateTrayColor(modeColors[to]);
  updateTrayTooltip(`ONE - ${modeSwitcher.getModeDisplayName(to)} Mode`);
});
```

### Settings Panel

```html
<!-- gui/settings.html -->
<section id="mode-settings">
  <h3>Mode Settings</h3>

  <div class="setting-row">
    <label>Current Mode</label>
    <select id="current-mode">
      <option value="general">General</option>
      <option value="music">Music</option>
      <option value="claude">Claude</option>
      <option value="code">Code</option>
    </select>
  </div>

  <div class="setting-row">
    <label>Auto-switch modes</label>
    <input type="checkbox" id="auto-mode" checked />
    <span class="hint">Automatically change mode based on focused app</span>
  </div>

  <div class="setting-row">
    <label>Notify on switch</label>
    <input type="checkbox" id="notify-mode-switch" checked />
    <span class="hint">Play sound when mode changes</span>
  </div>

  <h4>Mode Rules</h4>
  <div id="mode-rules-list">
    <!-- Dynamic rule list -->
  </div>

  <button onclick="addModeRule()">+ Add Rule</button>
</section>
```

## Voice Commands for Mode

### Switch Mode
```
"Computer music mode"     → forceMode('music')
"Switch to Claude mode"   → forceMode('claude')
"General mode"            → forceMode('general')
```

### Check Mode
```
"What mode am I in?"      → "You're in music mode"
"Current mode"            → "Music mode, auto-switched from Ableton"
```

### Toggle Auto-Switch
```
"Disable auto mode"       → settings.auto_switch_enabled = false
"Enable auto switching"   → settings.auto_switch_enabled = true
"Stay in this mode"       → temporarilyDisableAuto(5min)
```

## Mode-Specific Command Sets

Each mode has a different command vocabulary emphasis:

### General Mode
- Dictation is primary
- Universal commands (copy, paste, undo)
- Navigation commands

### Music Mode
- Transport commands (play, stop, record, loop)
- Mixer commands (solo, mute, volume)
- DAW-specific commands

### Claude Mode
- AI conversation is primary
- Code generation commands
- Query commands

### Code Mode
- Run/debug commands
- File commands
- Refactoring commands

## State Machine

```
                    ┌─────────────────────┐
                    │    IDLE             │
                    │ (watching context)  │
                    └──────────┬──────────┘
                               │ app-changed event
                               ▼
                    ┌─────────────────────┐
                    │   DEBOUNCING        │
                    │  (500ms wait)       │
                    └──────────┬──────────┘
                    ┌──────────┴──────────┐
           same app │                     │ still different
                    ▼                     ▼
           ┌────────────┐        ┌────────────────┐
           │  CANCEL    │        │ EVALUATE_RULES │
           └────────────┘        └───────┬────────┘
                               ┌─────────┴─────────┐
                          rule │                   │ no rule
                         match │                   │ match
                               ▼                   ▼
                    ┌─────────────────┐   ┌─────────────────┐
                    │  SWITCH_MODE    │   │ REVERT/KEEP     │
                    │  (notify user)  │   │ (stay current)  │
                    └────────┬────────┘   └────────┬────────┘
                             └──────────┬──────────┘
                                        ▼
                    ┌─────────────────────┐
                    │    IDLE             │
                    └─────────────────────┘
```

## Configuration Persistence

```javascript
// Mode settings are saved to:
// ~/.config/one/mode_settings.json

{
  "current_mode": "general",
  "auto_switch_enabled": true,
  "notify_on_switch": true,
  "switch_delay_ms": 500,

  "custom_rules": [
    {
      "name": "VS Code to Code mode",
      "trigger": { "bundleId": "com.microsoft.VSCode" },
      "action": { "mode": "code" },
      "enabled": true
    }
  ],

  "disabled_default_rules": ["terminal-claude"],

  "mode_history": [
    { "mode": "music", "timestamp": "2025-12-08T10:30:00Z", "source": "auto" },
    { "mode": "general", "timestamp": "2025-12-08T10:35:00Z", "source": "manual" }
  ]
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/mode-switcher.js` | CREATE |
| `src/data/mode_rules.json` | CREATE |
| `src/index.js` | MODIFY - integrate mode switcher |
| `gui/main.cjs` | MODIFY - IPC handlers for mode |
| `gui/settings.html` | MODIFY - mode settings UI |

## Testing

```javascript
describe('ModeSwitcher', () => {
  test('switches to music mode in DAW', async () => {
    const switcher = new ModeSwitcher();
    await switcher.init();

    // Simulate Ableton focus
    contextService.emit('app-changed', {
      from: 'com.apple.finder',
      to: 'com.ableton.live'
    });

    // Wait for debounce
    await sleep(600);

    expect(switcher.getMode()).toBe('music');
  });

  test('manual mode disables auto temporarily', () => {
    const switcher = new ModeSwitcher();
    switcher.forceMode('claude');

    expect(switcher.settings.auto_switch_enabled).toBe(false);

    // After 30s, auto is re-enabled
  });

  test('respects disabled rules', async () => {
    const switcher = new ModeSwitcher({
      // User disabled terminal-claude rule
    });

    contextService.emit('app-changed', {
      to: 'com.apple.Terminal'
    });

    await sleep(600);
    expect(switcher.getMode()).not.toBe('claude');
  });
});
```

## Success Criteria

- Mode switch < 100ms after debounce
- No mode flapping on rapid app switches
- Manual override respected for 30s
- Smooth GUI indicator updates
- Zero-config reasonable defaults

---

*Phase 3.3 Spec by thinker | 2025-12-08*
