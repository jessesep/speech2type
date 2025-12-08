# Secure API Key Storage (Task 1.1)

> Use macOS Keychain instead of plaintext config files

## Problem

Currently API keys are stored in `~/.config/speech2type/config.json`:
```json
{
  "anthropic_api_key": "sk-ant-...",  // INSECURE!
  "deepgram_api_key": "..."
}
```

This is a security risk - anyone with file access can steal the keys.

## Solution

Use `keytar` package to store secrets in macOS Keychain (encrypted, OS-protected).

## Implementation

### 1. Install keytar

```bash
npm install keytar
```

**Note:** keytar has native bindings. May need:
```bash
npm install --build-from-source keytar
```

### 2. Create secrets.js

```javascript
// src/services/secrets.js
import keytar from 'keytar';

const SERVICE_NAME = 'one-voice';

/**
 * Get a secret from macOS Keychain
 */
export async function getSecret(key) {
  return await keytar.getPassword(SERVICE_NAME, key);
}

/**
 * Store a secret in macOS Keychain
 */
export async function setSecret(key, value) {
  await keytar.setPassword(SERVICE_NAME, key, value);
}

/**
 * Delete a secret from Keychain
 */
export async function deleteSecret(key) {
  await keytar.deletePassword(SERVICE_NAME, key);
}

/**
 * Check if a secret exists
 */
export async function hasSecret(key) {
  const value = await keytar.getPassword(SERVICE_NAME, key);
  return value !== null;
}

// Convenience functions for specific keys
export const getAnthropicKey = () => getSecret('anthropic_api_key');
export const setAnthropicKey = (key) => setSecret('anthropic_api_key', key);

export const getDeepgramKey = () => getSecret('deepgram_api_key');
export const setDeepgramKey = (key) => setSecret('deepgram_api_key', key);
```

### 3. Migration from config.json

On first run with new version, migrate existing keys:

```javascript
// src/services/secrets.js (add to file)
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(
  process.env.HOME,
  '.config/speech2type/config.json'
);

export async function migrateFromConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return;

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

    // Migrate Anthropic key
    if (config.anthropic_api_key && !await hasSecret('anthropic_api_key')) {
      await setAnthropicKey(config.anthropic_api_key);
      console.log('[Secrets] Migrated Anthropic key to Keychain');

      // Remove from config file
      delete config.anthropic_api_key;
    }

    // Migrate Deepgram key
    if (config.deepgramApiKey && !await hasSecret('deepgram_api_key')) {
      await setDeepgramKey(config.deepgramApiKey);
      console.log('[Secrets] Migrated Deepgram key to Keychain');

      // Keep in config for now (Deepgram SDK reads it)
      // TODO: Update Deepgram initialization to use Keychain
    }

    // Save cleaned config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  } catch (e) {
    console.error('[Secrets] Migration failed:', e.message);
  }
}
```

### 4. Update intent-resolver.js

```javascript
// src/services/intent-resolver.js
import { getAnthropicKey } from './secrets.js';

export class IntentResolver {
  async init() {
    const apiKey = await getAnthropicKey();

    if (!apiKey) {
      console.log('[IntentResolver] No API key - using CLI mode only');
      this.mode = 'cli';
      return;
    }

    this.client = new Anthropic({ apiKey });
    this.mode = 'api';
  }

  // ... rest of implementation
}
```

### 5. GUI: Settings Panel

Add to `gui/settings.html` in the API tab:

```html
<div class="setting-row">
  <label>Anthropic API Key</label>
  <div class="key-input-group">
    <input
      type="password"
      id="anthropic-key"
      placeholder="sk-ant-..."
      autocomplete="off"
    />
    <button id="toggle-key-visibility">👁</button>
    <button id="save-anthropic-key">Save</button>
  </div>
  <span class="key-status" id="anthropic-status">
    <!-- Shows: ✓ Configured / ✗ Not set -->
  </span>
</div>
```

```javascript
// gui/main.cjs - add IPC handlers

const { ipcMain } = require('electron');
const keytar = require('keytar');

const SERVICE_NAME = 'one-voice';

ipcMain.handle('get-key-status', async (event, keyName) => {
  const value = await keytar.getPassword(SERVICE_NAME, keyName);
  return value !== null;
});

ipcMain.handle('set-api-key', async (event, keyName, value) => {
  await keytar.setPassword(SERVICE_NAME, keyName, value);
  return true;
});

ipcMain.handle('delete-api-key', async (event, keyName) => {
  await keytar.deletePassword(SERVICE_NAME, keyName);
  return true;
});
```

### 6. CLI Command

Add to package.json scripts or create separate CLI:

```bash
# Set API key from command line
one config set anthropic_key sk-ant-xxx

# Check if key is set
one config check anthropic_key

# Delete key
one config delete anthropic_key
```

```javascript
// bin/one-config.js
#!/usr/bin/env node
import { setSecret, hasSecret, deleteSecret } from '../src/services/secrets.js';

const [,, action, key, value] = process.argv;

async function main() {
  switch (action) {
    case 'set':
      await setSecret(key, value);
      console.log(`✓ ${key} saved to Keychain`);
      break;

    case 'check':
      const exists = await hasSecret(key);
      console.log(exists ? `✓ ${key} is configured` : `✗ ${key} not set`);
      break;

    case 'delete':
      await deleteSecret(key);
      console.log(`✓ ${key} removed from Keychain`);
      break;

    default:
      console.log('Usage: one config <set|check|delete> <key> [value]');
  }
}

main();
```

### 7. Validate on Startup

```javascript
// src/index.js - add to initialization
import { getAnthropicKey, migrateFromConfig } from './services/secrets.js';

async function validateSecrets() {
  // Run migration first
  await migrateFromConfig();

  const anthropicKey = await getAnthropicKey();

  if (!anthropicKey) {
    console.log('[ONE] No Anthropic API key configured');
    console.log('[ONE] AI command understanding will use CLI mode');
    console.log('[ONE] Run: one config set anthropic_key YOUR_KEY');
  } else if (!anthropicKey.startsWith('sk-ant-')) {
    console.warn('[ONE] Anthropic key format looks invalid');
  } else {
    console.log('[ONE] Anthropic API key configured ✓');
  }
}
```

## Security Notes

1. **Keychain is encrypted** - Protected by macOS login password
2. **App-specific access** - Other apps can't read ONE's secrets
3. **No plaintext** - Keys never written to disk unencrypted
4. **Migration cleans up** - Old config.json keys are deleted after migration

## Testing

```javascript
// tests/secrets.test.js
import { setSecret, getSecret, deleteSecret, hasSecret } from '../src/services/secrets.js';

describe('Secrets Service', () => {
  const TEST_KEY = 'test_key';
  const TEST_VALUE = 'test_value_123';

  afterEach(async () => {
    await deleteSecret(TEST_KEY);
  });

  test('stores and retrieves secret', async () => {
    await setSecret(TEST_KEY, TEST_VALUE);
    const retrieved = await getSecret(TEST_KEY);
    expect(retrieved).toBe(TEST_VALUE);
  });

  test('hasSecret returns true for existing', async () => {
    await setSecret(TEST_KEY, TEST_VALUE);
    expect(await hasSecret(TEST_KEY)).toBe(true);
  });

  test('hasSecret returns false for missing', async () => {
    expect(await hasSecret(TEST_KEY)).toBe(false);
  });

  test('deleteSecret removes key', async () => {
    await setSecret(TEST_KEY, TEST_VALUE);
    await deleteSecret(TEST_KEY);
    expect(await hasSecret(TEST_KEY)).toBe(false);
  });
});
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/secrets.js` | CREATE |
| `src/services/intent-resolver.js` | MODIFY - use secrets |
| `src/index.js` | MODIFY - add validation |
| `gui/main.cjs` | MODIFY - add IPC handlers |
| `gui/settings.html` | MODIFY - add key input UI |
| `bin/one-config.js` | CREATE (optional CLI) |
| `package.json` | MODIFY - add keytar dep |

## Estimated Effort

- Implementation: 1-2 hours
- Testing: 30 minutes
- GUI polish: 30 minutes

---

*Spec by thinker | 2024-12-08*
