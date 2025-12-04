# Addon Developer Guide

Create custom voice command modes for speech2type.

## Overview

Addons are self-contained modules that add new voice command modes. Each addon:
- Has its own activation phrase ("computer music mode", "computer my mode")
- Defines commands and patterns specific to its use case
- Can optionally enable push-to-talk behavior
- Is automatically loaded from the `addons/` directory

## File Structure

```
addons/
  my-addon/
    index.js      # Main addon code (required)
    README.md     # Documentation (recommended)
    package.json  # Dependencies (optional)
```

## Creating an Addon

### Step 1: Create the Folder

```bash
mkdir -p addons/my-addon
```

### Step 2: Create index.js

```javascript
/**
 * My Addon for speech2type
 * Brief description of what it does
 */

// ============================================================================
// METADATA (required)
// ============================================================================

export const metadata = {
  name: 'my-addon',           // Internal name (folder name)
  displayName: 'My Addon',    // Human-readable name
  version: '1.0.0',
  description: 'What this addon does',
  author: 'Your Name',

  // Mode activation
  modeCommand: 'my mode',     // "computer my mode" activates this
  modeAliases: ['addon mode'], // Alternative: "computer addon mode"

  // Push-to-talk (optional)
  pushToTalk: false,          // true = Cmd+Option to speak
  pushToTalkAutoSubmit: false, // true = auto-Enter on release
};

// ============================================================================
// COMMANDS - Static phrase mappings
// ============================================================================

/**
 * Map spoken phrases to action identifiers.
 * Phrases are WITHOUT the "computer" prefix (it's added automatically).
 */
export const commands = {
  // Basic command
  'hello': 'say_hello',

  // Multiple variations for same action (recommended)
  'start': 'begin',
  'begin': 'begin',
  'go': 'begin',

  // Multi-word phrases
  'do something': 'do_something',
  'do the thing': 'do_something',
};

// ============================================================================
// PATTERNS - Dynamic commands with parameters
// ============================================================================

/**
 * Regex patterns for commands with values.
 * Patterns are WITHOUT the "computer" prefix (it's added automatically).
 */
export const patterns = [
  {
    pattern: /^set\s+level\s+(\d+)$/,  // "computer set level 50"
    action: 'set_level',
    extract: (match) => parseInt(match[1])
  },
  {
    pattern: /^level\s+(\d+)$/,         // "computer level 50"
    action: 'set_level',
    extract: (match) => parseInt(match[1])
  },
  {
    // Multiple capture groups
    pattern: /^move\s+(\w+)\s+to\s+(\d+)$/,  // "computer move item to 5"
    action: 'move_item',
    extract: (match) => ({ item: match[1], position: parseInt(match[2]) })
  },
];

// ============================================================================
// LIFECYCLE
// ============================================================================

/**
 * Called when this addon's mode is activated.
 * Use for setup, connections, etc.
 */
export function init() {
  console.log('[my-addon] Initialized');
}

/**
 * Called when switching away from this mode.
 * Use for cleanup, disconnections, etc.
 */
export function cleanup() {
  console.log('[my-addon] Cleaned up');
}

// ============================================================================
// ACTION HANDLER
// ============================================================================

/**
 * Execute an action.
 * @param {string} action - The action identifier from commands/patterns
 * @param {any} value - Extracted value from patterns (null for static commands)
 * @returns {boolean|string} - true if handled, string to delegate to main app
 */
export function execute(action, value) {
  switch (action) {
    case 'say_hello':
      console.log('Hello from my addon!');
      return true;

    case 'begin':
      console.log('Beginning...');
      return true;

    case 'do_something':
      console.log('Doing something');
      return true;

    case 'set_level':
      console.log(`Level set to ${value}`);
      return true;

    case 'move_item':
      console.log(`Moving ${value.item} to position ${value.position}`);
      return true;

    // Delegate to main app's action
    case 'find':
      return 'find';  // Will call typerService.find()

    default:
      return false;  // Action not handled
  }
}
```

### Step 3: Create README.md

Document your addon for users:

```markdown
# My Addon for speech2type

Brief description.

## Requirements

- List any external requirements

## Installation

1. Copy `my-addon` folder to `speech2type/addons/`
2. Restart speech2type

## Usage

Say "computer my mode" to activate.

## Commands

| Command | Action |
|---------|--------|
| computer hello | Says hello |
| computer level 50 | Sets level to 50 |
```

## Best Practices

### 1. Command Variations

Speech recognition isn't perfect. Add 3-5 variations per command:

```javascript
export const commands = {
  // Synonyms
  'play': 'play',
  'start': 'play',
  'go': 'play',

  // Common mishearings
  'playing': 'play',
  'played': 'play',

  // Natural phrasing
  'start playing': 'play',
  'begin playback': 'play',
};
```

### 2. Pattern Variations

Same for patterns:

```javascript
export const patterns = [
  // "set volume 50"
  { pattern: /^set\s+volume\s+(\d+)$/, action: 'volume', extract: (m) => parseInt(m[1]) },
  // "volume 50"
  { pattern: /^volume\s+(\d+)$/, action: 'volume', extract: (m) => parseInt(m[1]) },
  // "50 percent volume"
  { pattern: /^(\d+)\s+percent\s+volume$/, action: 'volume', extract: (m) => parseInt(m[1]) },
];
```

### 3. User-Friendly Numbers

Use 1-indexed numbers in voice commands, convert internally:

```javascript
export function execute(action, value) {
  switch (action) {
    case 'select_track':
      // User says "track 1", internally use 0
      const trackIndex = value - 1;
      doSomething(trackIndex);
      return true;
  }
}
```

### 4. Logging

Use chalk for colored console output:

```javascript
import chalk from 'chalk';

export function execute(action, value) {
  console.log(chalk.blue(`[my-addon] ${action} → ${value}`));
  // ...
}
```

### 5. External Connections

Handle connections in init/cleanup:

```javascript
let client = null;

export function init() {
  client = new SomeClient('localhost', 12345);
  client.connect();
}

export function cleanup() {
  if (client) {
    client.disconnect();
    client = null;
  }
}
```

### 6. Error Handling

Don't let errors crash the main app:

```javascript
export function execute(action, value) {
  try {
    // risky operation
  } catch (error) {
    console.error(`[my-addon] Error: ${error.message}`);
    return false;
  }
}
```

## Delegating Actions

Return a string from `execute()` to use main app features:

```javascript
export function execute(action, value) {
  switch (action) {
    case 'search':
      return 'find';  // Opens Cmd+F dialog
    case 'submit':
      return 'enter'; // Presses Enter
  }
}
```

Available delegations:
- `enter` - Press Enter
- `copy` - Cmd+C
- `paste` - Cmd+V
- `cut` - Cmd+X
- `save` - Cmd+S
- `find` - Cmd+F
- `select_all` - Cmd+A
- `new_tab` - Cmd+T
- `close_tab` - Cmd+W
- `new_window` - Cmd+N

## Push-to-Talk Mode

Enable push-to-talk for addons where continuous listening would interfere:

```javascript
export const metadata = {
  // ...
  pushToTalk: true,           // Listening off by default
  pushToTalkAutoSubmit: true, // Press Enter on release
};
```

With push-to-talk:
- **Hold Cmd+Option** → Start listening
- **Release Cmd+Option** → Auto-submit (if enabled) and stop

## Testing Your Addon

1. Load speech2type with your addon in the addons folder
2. Check console for "Loaded: My Addon v1.0.0"
3. Say "computer my mode" to activate
4. Test each command variation
5. Check console output for debugging

## Example: OSC-Based Addon

See the [Ableton addon](../addons/ableton/) for a complete example using OSC communication.

Key features:
- OSC client connection in init/cleanup
- Comprehensive command variations
- Dynamic patterns for track/scene numbers
- Push-to-talk mode

## Publishing Your Addon

1. Create a GitHub repository for your addon
2. Include README with installation instructions
3. Tag releases with semantic versions
4. Submit a PR to add it to the addons list
