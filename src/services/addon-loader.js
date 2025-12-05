/**
 * Addon Loader Service
 *
 * Dynamically loads and manages addons from the addons/ directory.
 * Each addon provides commands, patterns, and action handlers for a specific mode.
 *
 * Users can enable/disable addons via config to customize their setup.
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

// Config path for addon settings
const CONFIG_DIR = path.join(os.homedir(), '.config', 'speech2type');
const ADDON_CONFIG_FILE = path.join(CONFIG_DIR, 'addons.json');

class AddonLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.addonsDir = path.join(projectRoot, 'addons');
    this.addons = new Map();  // name -> addon module
    this.modeMap = new Map(); // mode command -> addon name
    this.activeAddon = null;
    this.enabledAddons = this.loadAddonConfig();
  }

  /**
   * Load addon enabled/disabled config
   */
  loadAddonConfig() {
    try {
      if (existsSync(ADDON_CONFIG_FILE)) {
        const data = readFileSync(ADDON_CONFIG_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      // Ignore errors, use defaults
    }
    // Default: all addons enabled
    return { enabled: {} };
  }

  /**
   * Save addon config
   */
  saveAddonConfig() {
    try {
      if (!existsSync(CONFIG_DIR)) {
        const { mkdirSync } = require('fs');
        mkdirSync(CONFIG_DIR, { recursive: true });
      }
      writeFileSync(ADDON_CONFIG_FILE, JSON.stringify(this.enabledAddons, null, 2));
    } catch (e) {
      console.error(chalk.red('[addons] Failed to save config:', e.message));
    }
  }

  /**
   * Check if an addon is enabled
   */
  isEnabled(name) {
    // Default to enabled if not explicitly disabled
    return this.enabledAddons.enabled[name] !== false;
  }

  /**
   * Enable an addon
   */
  enableAddon(name) {
    this.enabledAddons.enabled[name] = true;
    this.saveAddonConfig();
    console.log(chalk.green(`[addons] Enabled: ${name}`));
  }

  /**
   * Disable an addon
   */
  disableAddon(name) {
    this.enabledAddons.enabled[name] = false;
    this.saveAddonConfig();

    // Deactivate if currently active
    if (this.activeAddon === name) {
      this.deactivate();
    }

    // Remove from mode map
    const addon = this.addons.get(name);
    if (addon && addon.metadata) {
      if (addon.metadata.modeCommand) {
        this.modeMap.delete(addon.metadata.modeCommand);
      }
      if (addon.metadata.modeAliases) {
        for (const alias of addon.metadata.modeAliases) {
          this.modeMap.delete(alias);
        }
      }
    }

    console.log(chalk.yellow(`[addons] Disabled: ${name}`));
  }

  /**
   * Load all addons from the addons/ directory
   */
  async loadAll() {
    if (!existsSync(this.addonsDir)) {
      console.log(chalk.dim('[addons] No addons directory found'));
      return;
    }

    const entries = readdirSync(this.addonsDir, { withFileTypes: true });
    let loadedCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const loaded = await this.loadAddon(entry.name);
        if (loaded) loadedCount++;
      }
    }

    console.log(chalk.dim(`[addons] Loaded ${loadedCount} addon(s)`));
  }

  /**
   * Load a single addon by name
   * @returns {boolean} true if addon was loaded and enabled
   */
  async loadAddon(name) {
    const addonPath = path.join(this.addonsDir, name, 'index.js');

    if (!existsSync(addonPath)) {
      console.log(chalk.yellow(`[addons] Skipping ${name}: no index.js found`));
      return false;
    }

    try {
      const addon = await import(addonPath);

      if (!addon.metadata) {
        console.log(chalk.yellow(`[addons] Skipping ${name}: no metadata exported`));
        return false;
      }

      // Always store the addon (so we can list all available addons)
      this.addons.set(name, addon);

      // Only register mode commands if addon is enabled
      if (!this.isEnabled(name)) {
        console.log(chalk.dim(`[addons] Available (disabled): ${addon.metadata.displayName || name}`));
        return false;
      }

      // Register mode command
      if (addon.metadata.modeCommand) {
        this.modeMap.set(addon.metadata.modeCommand, name);
      }

      // Register mode aliases
      if (addon.metadata.modeAliases) {
        for (const alias of addon.metadata.modeAliases) {
          this.modeMap.set(alias, name);
        }
      }

      console.log(chalk.green(`[addons] Loaded: ${addon.metadata.displayName || name} v${addon.metadata.version || '1.0.0'}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`[addons] Failed to load ${name}: ${error.message}`));
      return false;
    }
  }

  /**
   * Get addon by name
   */
  get(name) {
    return this.addons.get(name);
  }

  /**
   * Get addon by mode command (e.g., "music mode" -> ableton addon)
   */
  getByModeCommand(modeCommand) {
    const name = this.modeMap.get(modeCommand);
    return name ? this.addons.get(name) : null;
  }

  /**
   * Activate an addon (switch to its mode)
   */
  activate(name) {
    // Deactivate current addon
    if (this.activeAddon) {
      const current = this.addons.get(this.activeAddon);
      if (current && current.cleanup) {
        current.cleanup();
      }
    }

    const addon = this.addons.get(name);
    if (!addon) {
      console.log(chalk.yellow(`[addons] Addon not found: ${name}`));
      return false;
    }

    // Initialize new addon
    if (addon.init) {
      addon.init();
    }

    this.activeAddon = name;
    console.log(chalk.magenta.bold(`[mode] Switched to ${addon.metadata.displayName || name} mode`));

    return true;
  }

  /**
   * Deactivate current addon (switch to general mode)
   */
  deactivate() {
    if (this.activeAddon) {
      const current = this.addons.get(this.activeAddon);
      if (current && current.cleanup) {
        current.cleanup();
      }
      this.activeAddon = null;
    }
  }

  /**
   * Get the currently active addon
   */
  getActive() {
    return this.activeAddon ? this.addons.get(this.activeAddon) : null;
  }

  /**
   * Get active addon metadata
   */
  getActiveMetadata() {
    const addon = this.getActive();
    return addon ? addon.metadata : null;
  }

  /**
   * Check if push-to-talk is enabled for active addon
   */
  isPushToTalkEnabled() {
    const metadata = this.getActiveMetadata();
    return metadata ? metadata.pushToTalk === true : false;
  }

  /**
   * Check if push-to-talk auto-submit is enabled
   */
  isPushToTalkAutoSubmit() {
    const metadata = this.getActiveMetadata();
    return metadata ? metadata.pushToTalkAutoSubmit === true : false;
  }

  /**
   * Check if commands-only mode is enabled (no text typing)
   * Checks temporary override first, then config, then addon metadata
   */
  isCommandsOnly() {
    // Temporary override takes precedence (for search mode, etc.)
    if (this.tempCommandsOnlyOverride !== undefined) {
      return this.tempCommandsOnlyOverride;
    }
    const settings = this.getActiveSettings();
    if (settings && settings.commandsOnly !== undefined) {
      return settings.commandsOnly;
    }
    const metadata = this.getActiveMetadata();
    return metadata ? metadata.commandsOnly === true : false;
  }

  /**
   * Temporarily override commandsOnly setting
   * Use null to clear the override
   */
  setTempCommandsOnly(value) {
    this.tempCommandsOnlyOverride = value;
    if (value === null || value === undefined) {
      delete this.tempCommandsOnlyOverride;
    }
  }

  /**
   * Check if TTS is enabled for active addon
   */
  isTTSEnabled() {
    const settings = this.getActiveSettings();
    if (settings && settings.ttsEnabled !== undefined) {
      return settings.ttsEnabled;
    }
    const metadata = this.getActiveMetadata();
    return metadata ? metadata.ttsEnabled === true : false;
  }

  /**
   * Get settings for active addon from config
   */
  getActiveSettings() {
    if (!this.activeAddon) return null;
    return this.enabledAddons.settings?.[this.activeAddon] || null;
  }

  /**
   * Get custom commands for active addon
   */
  getCustomCommands() {
    const settings = this.getActiveSettings();
    if (!settings || !settings.customCommands) return {};

    const prefixed = {};
    for (const [phrase, action] of Object.entries(settings.customCommands)) {
      // Add "computer" prefix if not present
      const key = phrase.startsWith('computer ') ? phrase : `computer ${phrase}`;
      prefixed[key] = action;
    }
    return prefixed;
  }

  /**
   * Reload addon config (for hot-reload)
   */
  reloadConfig() {
    this.enabledAddons = this.loadAddonConfig();
    console.log(chalk.dim('[addons] Config reloaded'));
  }

  /**
   * Get all registered mode commands (for building command list)
   */
  getModeCommands() {
    const commands = {};
    for (const [modeCmd, addonName] of this.modeMap) {
      commands[`computer ${modeCmd}`] = `mode_addon_${addonName}`;
    }
    return commands;
  }

  /**
   * Get commands for the active addon (with "computer" prefix added)
   * Includes both addon commands and custom commands from config
   */
  getActiveCommands() {
    const addon = this.getActive();
    const prefixed = {};

    // Add addon's built-in commands
    if (addon && addon.commands) {
      for (const [phrase, action] of Object.entries(addon.commands)) {
        prefixed[`computer ${phrase}`] = action;
      }
    }

    // Add custom commands from config (can override built-in)
    const customCommands = this.getCustomCommands();
    Object.assign(prefixed, customCommands);

    return prefixed;
  }

  /**
   * Get patterns for the active addon (with "computer" prefix added to patterns)
   */
  getActivePatterns() {
    const addon = this.getActive();
    if (!addon || !addon.patterns) return [];

    return addon.patterns.map(p => ({
      pattern: new RegExp(`^computer\\s+${p.pattern.source.replace(/^\^/, '')}`, p.pattern.flags),
      action: p.action,
      extract: p.extract,
    }));
  }

  /**
   * Execute an action on the active addon
   */
  executeAction(action, value) {
    const addon = this.getActive();
    if (!addon || !addon.execute) return false;

    return addon.execute(action, value);
  }

  /**
   * List all loaded addons (only enabled ones)
   */
  list() {
    return Array.from(this.addons.entries())
      .filter(([name]) => this.isEnabled(name))
      .map(([name, addon]) => ({
        name,
        ...addon.metadata,
      }));
  }

  /**
   * List all available addons (enabled and disabled)
   */
  listAll() {
    return Array.from(this.addons.entries()).map(([name, addon]) => ({
      name,
      enabled: this.isEnabled(name),
      ...addon.metadata,
    }));
  }

  /**
   * Get addon config file path (for GUI)
   */
  getConfigPath() {
    return ADDON_CONFIG_FILE;
  }
}

export { AddonLoader };
