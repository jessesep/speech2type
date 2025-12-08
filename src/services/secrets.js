/**
 * Secure API Key Storage using macOS Keychain
 *
 * Uses keytar to store sensitive credentials securely instead of plaintext config files.
 */

import keytar from 'keytar';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SERVICE_NAME = 'one-voice';
const CONFIG_PATH = join(homedir(), '.config', 'speech2type', 'config.json');

/**
 * Get a secret from macOS Keychain
 * @param {string} key - The key name (e.g., 'anthropic_api_key')
 * @returns {Promise<string|null>} The secret value or null if not found
 */
export async function getSecret(key) {
  try {
    return await keytar.getPassword(SERVICE_NAME, key);
  } catch (e) {
    console.error(`[secrets] Failed to get ${key}:`, e.message);
    return null;
  }
}

/**
 * Store a secret in macOS Keychain
 * @param {string} key - The key name
 * @param {string} value - The secret value
 */
export async function setSecret(key, value) {
  try {
    await keytar.setPassword(SERVICE_NAME, key, value);
  } catch (e) {
    console.error(`[secrets] Failed to set ${key}:`, e.message);
    throw e;
  }
}

/**
 * Delete a secret from Keychain
 * @param {string} key - The key name
 */
export async function deleteSecret(key) {
  try {
    await keytar.deletePassword(SERVICE_NAME, key);
  } catch (e) {
    console.error(`[secrets] Failed to delete ${key}:`, e.message);
  }
}

/**
 * Check if a secret exists in Keychain
 * @param {string} key - The key name
 * @returns {Promise<boolean>}
 */
export async function hasSecret(key) {
  const value = await getSecret(key);
  return value !== null;
}

// Convenience functions for specific keys
export const getAnthropicKey = () => getSecret('anthropic_api_key');
export const setAnthropicKey = (key) => setSecret('anthropic_api_key', key);
export const hasAnthropicKey = () => hasSecret('anthropic_api_key');
export const deleteAnthropicKey = () => deleteSecret('anthropic_api_key');

export const getDeepgramKey = () => getSecret('deepgram_api_key');
export const setDeepgramKey = (key) => setSecret('deepgram_api_key', key);
export const hasDeepgramKey = () => hasSecret('deepgram_api_key');
export const deleteDeepgramKey = () => deleteSecret('deepgram_api_key');

/**
 * Migrate API keys from config.json to Keychain
 * Called on first run with new version
 */
export async function migrateFromConfig() {
  if (!existsSync(CONFIG_PATH)) return { migrated: [] };

  const migrated = [];

  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    let configChanged = false;

    // Migrate Anthropic key (check both possible key names)
    const anthropicKey = config.anthropicApiKey || config.anthropic_api_key;
    if (anthropicKey && !await hasAnthropicKey()) {
      await setAnthropicKey(anthropicKey);
      console.log('[secrets] Migrated Anthropic key to Keychain');
      migrated.push('anthropic_api_key');

      // Remove from config file
      delete config.anthropicApiKey;
      delete config.anthropic_api_key;
      configChanged = true;
    }

    // Migrate Deepgram key
    const deepgramKey = config.deepgramApiKey || config.deepgram_api_key;
    if (deepgramKey && !await hasDeepgramKey()) {
      await setDeepgramKey(deepgramKey);
      console.log('[secrets] Migrated Deepgram key to Keychain');
      migrated.push('deepgram_api_key');

      // Remove from config file
      delete config.deepgramApiKey;
      delete config.deepgram_api_key;
      configChanged = true;
    }

    // Save cleaned config if we migrated anything
    if (configChanged) {
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('[secrets] Cleaned plaintext keys from config.json');
    }

    return { migrated };

  } catch (e) {
    console.error('[secrets] Migration failed:', e.message);
    return { migrated: [], error: e.message };
  }
}

/**
 * Validate API key format
 * @param {string} key - The API key to validate
 * @param {string} type - 'anthropic' or 'deepgram'
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateKeyFormat(key, type) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key is empty' };
  }

  if (type === 'anthropic') {
    if (!key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Anthropic keys should start with sk-ant-' };
    }
    if (key.length < 40) {
      return { valid: false, error: 'Key appears too short' };
    }
  } else if (type === 'deepgram') {
    if (key.length < 20) {
      return { valid: false, error: 'Key appears too short' };
    }
  }

  return { valid: true };
}

/**
 * Get status of all configured secrets
 * @returns {Promise<object>} Status of each secret
 */
export async function getSecretsStatus() {
  return {
    anthropic: await hasAnthropicKey(),
    deepgram: await hasDeepgramKey()
  };
}

export default {
  getSecret,
  setSecret,
  deleteSecret,
  hasSecret,
  getAnthropicKey,
  setAnthropicKey,
  hasAnthropicKey,
  deleteAnthropicKey,
  getDeepgramKey,
  setDeepgramKey,
  hasDeepgramKey,
  deleteDeepgramKey,
  migrateFromConfig,
  validateKeyFormat,
  getSecretsStatus
};
