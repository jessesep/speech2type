# Per-App Command Profiles (Phase 3.2)

> Different apps, same phrase, different actions

## Overview

App Profiles allow the same voice command to do different things based on which app is focused. This is essential for natural voice interaction - users shouldn't need to learn app-specific command vocabularies.

**Example:**
```
In VS Code:    "run" → npm start
In Ableton:    "run" → play from start
In Figma:      "run" → present prototype
In Terminal:   "run" → execute last command
```

## Profile Structure

Profiles are stored in the personal dictionary with a `context_rules` section:

```json
// ~/.config/one/personal_commands.json
{
  "commands": [
    {
      "id": "cmd_play",
      "action": "media_play",
      "phrases": ["play", "start playing", "resume"],
      "source": "default",
      "confidence": 1.0,

      "context_rules": [
        {
          "match": { "bundleId": "com.ableton.live" },
          "action": "transport_play",
          "priority": 10
        },
        {
          "match": { "bundleId": "com.spotify.client" },
          "action": "spotify_play",
          "priority": 10
        },
        {
          "match": { "category": "daw" },
          "action": "transport_play",
          "priority": 5
        },
        {
          "match": { "category": "music" },
          "action": "media_play",
          "priority": 5
        }
      ]
    }
  ],

  "app_profiles": {
    "com.ableton.live": {
      "name": "Ableton Live",
      "category": "daw",
      "commands": {
        "play": "transport_play",
        "stop": "transport_stop",
        "record": "transport_record",
        "loop": "toggle_loop",
        "undo": "undo_last",
        "save": "save_project"
      }
    },
    "com.microsoft.VSCode": {
      "name": "VS Code",
      "category": "editor",
      "commands": {
        "run": "run_task",
        "debug": "start_debug",
        "save": "save_file",
        "find": "open_search",
        "terminal": "toggle_terminal"
      }
    }
  }
}
```

## Context Matching

Context rules support multiple match criteria:

```javascript
// Match types (in priority order)
const matchTypes = {
  // Exact bundle ID (highest specificity)
  bundleId: 'com.ableton.live',

  // App category
  category: 'daw',  // daw, editor, browser, terminal, music, design, communication

  // Mode
  mode: 'music',

  // URL pattern (for browsers)
  url: 'github.com/*',

  // Workspace type
  workspace: 'git',

  // Time-based
  timeOfDay: 'morning',  // morning, afternoon, evening, night

  // Recent activity
  recentAction: 'record',  // If user recently did this action
};

// Complex matching
const rule = {
  match: {
    bundleId: 'com.apple.Terminal',
    recentAction: 'claude_start'  // AND condition
  },
  action: 'claude_query',
  priority: 15
};
```

## Implementation

### 1. Profile Manager

```javascript
// src/services/profiles.js
export class ProfileManager {
  constructor(commandDictionary) {
    this.dictionary = commandDictionary;
    this.defaultProfiles = this.loadDefaultProfiles();
  }

  /**
   * Resolve action for phrase in current context
   */
  resolveWithProfile(phrase, context) {
    const normalizedPhrase = this.normalize(phrase);

    // 1. Check explicit app profiles
    const appProfile = this.getAppProfile(context.app.bundleId);
    if (appProfile?.commands?.[normalizedPhrase]) {
      return {
        action: appProfile.commands[normalizedPhrase],
        confidence: 1.0,
        source: 'app_profile',
        context: context.app.bundleId
      };
    }

    // 2. Check context_rules on matching commands
    const command = this.dictionary.findCommandByPhrase(normalizedPhrase);
    if (command?.context_rules) {
      const matchingRule = this.findBestMatchingRule(command.context_rules, context);
      if (matchingRule) {
        return {
          action: matchingRule.action,
          confidence: 0.95,
          source: 'context_rule',
          context: matchingRule.match
        };
      }
    }

    // 3. Check category defaults
    const categoryProfile = this.getCategoryProfile(context.app.category);
    if (categoryProfile?.commands?.[normalizedPhrase]) {
      return {
        action: categoryProfile.commands[normalizedPhrase],
        confidence: 0.9,
        source: 'category_profile',
        context: context.app.category
      };
    }

    // No profile match - return null for normal resolution
    return null;
  }

  findBestMatchingRule(rules, context) {
    const matchingRules = rules
      .filter(rule => this.ruleMatches(rule.match, context))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return matchingRules[0] || null;
  }

  ruleMatches(match, context) {
    for (const [key, value] of Object.entries(match)) {
      switch (key) {
        case 'bundleId':
          if (context.app.bundleId !== value) return false;
          break;
        case 'category':
          if (context.app.category !== value) return false;
          break;
        case 'mode':
          if (context.mode !== value) return false;
          break;
        case 'recentAction':
          if (!context.recentCommands.some(c => c.action === value)) return false;
          break;
        case 'url':
          // Browser URL matching
          if (!this.urlMatches(context.app.url, value)) return false;
          break;
      }
    }
    return true;
  }

  urlMatches(url, pattern) {
    if (!url) return false;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  }

  getAppProfile(bundleId) {
    return this.dictionary.data.app_profiles?.[bundleId]
        || this.defaultProfiles.apps[bundleId];
  }

  getCategoryProfile(category) {
    return this.defaultProfiles.categories[category];
  }

  normalize(phrase) {
    return phrase.toLowerCase().trim();
  }

  loadDefaultProfiles() {
    return {
      apps: {
        // Built-in app profiles
        'com.ableton.live': {
          name: 'Ableton Live',
          category: 'daw',
          commands: {
            'play': 'transport_play',
            'stop': 'transport_stop',
            'record': 'transport_record',
            'pause': 'transport_stop',
            'loop': 'toggle_loop',
            'solo': 'solo_selected',
            'mute': 'mute_selected',
          }
        },
        'com.spotify.client': {
          name: 'Spotify',
          category: 'music',
          commands: {
            'play': 'spotify_play',
            'pause': 'spotify_pause',
            'next': 'spotify_next',
            'previous': 'spotify_previous',
            'shuffle': 'spotify_toggle_shuffle',
          }
        }
      },
      categories: {
        'daw': {
          commands: {
            'play': 'transport_play',
            'stop': 'transport_stop',
            'record': 'transport_record',
          }
        },
        'terminal': {
          commands: {
            'run': 'execute_command',
            'clear': 'clear_terminal',
            'cancel': 'send_ctrl_c',
          }
        },
        'editor': {
          commands: {
            'run': 'run_current_file',
            'debug': 'start_debugger',
            'save': 'save_file',
          }
        },
        'browser': {
          commands: {
            'refresh': 'reload_page',
            'back': 'go_back',
            'forward': 'go_forward',
          }
        }
      }
    };
  }
}
```

### 2. Integration with IntentResolver

```javascript
// src/services/intent-resolver.js
import { ProfileManager } from './profiles.js';

export class IntentResolver {
  constructor() {
    this.profiles = new ProfileManager(commandDictionary);
  }

  async resolve(phrase, context) {
    // Check profiles first (Tier 0)
    const profileMatch = this.profiles.resolveWithProfile(phrase, context);
    if (profileMatch) {
      return { ...profileMatch, tier: 0 };
    }

    // Continue with normal Tier 1, 2, 3 resolution
    // ...
  }
}
```

## Training Per-App Commands

Voice training for app-specific commands:

```
User: "Computer learn"
ONE: "Training mode. What should I learn?"

User: "In Ableton, when I say 'bounce', export the track"
ONE: "Got it. In Ableton Live, 'bounce' will export. Confirm?"

User: "Affirmative"
ONE: "Learned. 'Bounce' is now Ableton-specific."
```

### Training Detection Patterns

```javascript
// Detect "in [app]" pattern
const appTrainingPatterns = [
  /^in (\w+),? when I say ['"]?(.+?)['"]?,? (.+)$/i,
  /^when (\w+) is open,? ['"]?(.+?)['"]? should (.+)$/i,
  /^for (\w+),? ['"]?(.+?)['"]? means (.+)$/i,
];

function parseAppTraining(phrase) {
  for (const pattern of appTrainingPatterns) {
    const match = phrase.match(pattern);
    if (match) {
      return {
        app: match[1],
        trigger: match[2],
        description: match[3]
      };
    }
  }
  return null;
}
```

### Storage

```javascript
// Add to personal_commands.json
async learnAppCommand(appName, phrase, action) {
  const bundleId = this.resolveAppName(appName);

  if (!this.data.app_profiles[bundleId]) {
    this.data.app_profiles[bundleId] = {
      name: appName,
      category: this.detectCategory(bundleId),
      commands: {}
    };
  }

  this.data.app_profiles[bundleId].commands[phrase.toLowerCase()] = action;
  await this.save();
}
```

## Profile Management UI

### Settings Panel

```html
<!-- gui/settings.html -->
<div class="profile-manager">
  <h3>App Profiles</h3>

  <div class="app-list">
    <!-- List of apps with custom commands -->
  </div>

  <div class="profile-editor" id="profile-editor" style="display: none;">
    <h4 id="profile-app-name">Ableton Live</h4>

    <table class="command-overrides">
      <thead>
        <tr>
          <th>Phrase</th>
          <th>Action</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="profile-commands">
        <!-- Dynamic rows -->
      </tbody>
    </table>

    <button onclick="addProfileCommand()">+ Add Command</button>
  </div>
</div>
```

### Voice-First Profile Management

```
"What are my Ableton commands?"
→ Lists all custom commands for Ableton

"Remove the bounce command from Ableton"
→ Deletes the custom override

"Make 'bounce' work everywhere, not just Ableton"
→ Promotes from app-specific to global
```

## Profile Inheritance

Profiles can inherit from categories:

```javascript
const resolveAction = (phrase, context) => {
  // 1. App-specific (highest priority)
  const appProfile = profiles.getAppProfile(context.app.bundleId);
  if (appProfile?.commands?.[phrase]) {
    return appProfile.commands[phrase];
  }

  // 2. Category defaults (medium priority)
  const categoryProfile = profiles.getCategoryProfile(context.app.category);
  if (categoryProfile?.commands?.[phrase]) {
    return categoryProfile.commands[phrase];
  }

  // 3. Global default (lowest priority)
  return dictionary.lookup(phrase)?.action;
};
```

## Import/Export

### Export Profile

```javascript
async exportAppProfile(bundleId) {
  const profile = this.data.app_profiles[bundleId];
  if (!profile) return null;

  return {
    version: '1.0',
    app: {
      bundleId,
      name: profile.name,
      category: profile.category
    },
    commands: profile.commands,
    exported_at: new Date().toISOString()
  };
}
```

### Import Profile

```javascript
async importAppProfile(profileData) {
  const { bundleId } = profileData.app;

  if (this.data.app_profiles[bundleId]) {
    // Merge with existing
    this.data.app_profiles[bundleId].commands = {
      ...this.data.app_profiles[bundleId].commands,
      ...profileData.commands
    };
  } else {
    // Create new
    this.data.app_profiles[bundleId] = {
      name: profileData.app.name,
      category: profileData.app.category,
      commands: profileData.commands
    };
  }

  await this.save();
}
```

## Community Profiles

Future: shareable profile packs

```json
// ableton-pro-pack.json
{
  "name": "Ableton Pro Commands",
  "author": "producer123",
  "version": "1.0.0",
  "apps": ["com.ableton.live"],
  "commands": {
    "bounce": "export_audio",
    "freeze": "freeze_track",
    "flatten": "flatten_track",
    "consolidate": "consolidate_clips",
    "warp": "toggle_warp",
    "quantize": "quantize_selected"
  }
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/profiles.js` | CREATE |
| `src/services/commands.js` | MODIFY - add app_profiles |
| `src/services/intent-resolver.js` | MODIFY - use ProfileManager |
| `gui/settings.html` | MODIFY - profile UI |
| `src/data/default_profiles.json` | CREATE |

## Testing

```javascript
describe('ProfileManager', () => {
  test('app profile overrides global', () => {
    const context = { app: { bundleId: 'com.ableton.live', category: 'daw' }};
    const result = profiles.resolveWithProfile('play', context);
    expect(result.action).toBe('transport_play');
  });

  test('category fallback works', () => {
    const context = { app: { bundleId: 'com.unknown.daw', category: 'daw' }};
    const result = profiles.resolveWithProfile('play', context);
    expect(result.action).toBe('transport_play'); // From category
  });

  test('no profile returns null', () => {
    const context = { app: { bundleId: 'com.unknown.app', category: 'unknown' }};
    const result = profiles.resolveWithProfile('randomphrase', context);
    expect(result).toBeNull();
  });

  test('priority ordering works', () => {
    // Add rules with different priorities and verify highest wins
  });
});
```

## Success Criteria

- Profile resolution < 5ms
- 100% override accuracy for configured apps
- Training new app command < 15 seconds
- Category fallback works for unknown apps

---

*Phase 3.2 Spec by thinker | 2025-12-08*
