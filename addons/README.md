# speech2type Addons

Addons extend speech2type with custom voice command modes for specific applications.

## Available Addons

| Addon | Description | Mode Command |
|-------|-------------|--------------|
| [ableton](./ableton/) | Control Ableton Live via OSC | "computer music mode" |

## Installing Addons

1. Download the addon folder
2. Place it in your `speech2type/addons/` directory
3. Restart speech2type

Addons are automatically loaded on startup.

## Creating Your Own Addon

See the [Developer Guide](../docs/addon-developer-guide.md) for detailed instructions.

### Quick Start

Create a new folder in `addons/` with an `index.js` file:

```
addons/
  my-addon/
    index.js
    README.md
```

### Minimal Example

```javascript
// Addon metadata (required)
export const metadata = {
  name: 'my-addon',
  displayName: 'My Addon',
  version: '1.0.0',
  description: 'Description of what this addon does',
  modeCommand: 'my mode',  // Activated with "computer my mode"
};

// Static commands (phrase → action)
export const commands = {
  'hello': 'say_hello',
  'goodbye': 'say_goodbye',
};

// Dynamic patterns (regex → action with extracted values)
export const patterns = [
  {
    pattern: /^set\s+value\s+(\d+)$/,
    action: 'set_value',
    extract: (match) => parseInt(match[1])
  },
];

// Initialize addon (called when mode is activated)
export function init() {
  console.log('My addon initialized');
}

// Cleanup addon (called when mode is deactivated)
export function cleanup() {
  console.log('My addon cleanup');
}

// Execute action (called when a command is recognized)
export function execute(action, value) {
  switch (action) {
    case 'say_hello':
      console.log('Hello!');
      return true;
    case 'say_goodbye':
      console.log('Goodbye!');
      return true;
    case 'set_value':
      console.log(`Value set to ${value}`);
      return true;
    default:
      return false;
  }
}
```

## Addon Structure

### Required Exports

| Export | Type | Description |
|--------|------|-------------|
| `metadata` | Object | Addon info and configuration |
| `commands` | Object | Static phrase-to-action mappings |
| `execute` | Function | Action handler |

### Optional Exports

| Export | Type | Description |
|--------|------|-------------|
| `patterns` | Array | Dynamic regex patterns |
| `init` | Function | Called when mode activates |
| `cleanup` | Function | Called when mode deactivates |

### Metadata Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Internal addon name |
| `displayName` | No | Human-readable name |
| `version` | No | Semantic version |
| `description` | No | Brief description |
| `modeCommand` | Yes | Phrase to activate (without "computer") |
| `modeAliases` | No | Alternative activation phrases |
| `pushToTalk` | No | Enable push-to-talk (Cmd+Option) |
| `pushToTalkAutoSubmit` | No | Auto-submit on push-to-talk release |

## Best Practices

### Speech Recognition Reliability

Add multiple variations for each command:

```javascript
export const commands = {
  // Synonyms
  'play': 'play',
  'start': 'play',
  'go': 'play',

  // Common mishearings
  'playing': 'play',

  // Natural phrasing
  'start playing': 'play',
};
```

### Dynamic Patterns

For commands with parameters:

```javascript
export const patterns = [
  // "set volume 50", "volume 50"
  { pattern: /^set\s+volume\s+(\d+)$/, action: 'volume', extract: (m) => parseInt(m[1]) },
  { pattern: /^volume\s+(\d+)$/, action: 'volume', extract: (m) => parseInt(m[1]) },
];
```

### Delegating to General Actions

Return a string from `execute()` to delegate to the main app:

```javascript
export function execute(action, value) {
  switch (action) {
    case 'find':
      return 'find';  // Delegates to typerService.find()
    // ...
  }
}
```

Supported delegations: `enter`, `copy`, `paste`, `cut`, `save`, `find`, `select_all`, `new_tab`, `close_tab`, `new_window`
