/**
 * Addon Loader Service
 *
 * Dynamically loads and manages addons from the addons/ directory.
 * Each addon provides commands, patterns, and action handlers for a specific mode.
 */

import { readdirSync, existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';

class AddonLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.addonsDir = path.join(projectRoot, 'addons');
    this.addons = new Map();  // name -> addon module
    this.modeMap = new Map(); // mode command -> addon name
    this.activeAddon = null;
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

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadAddon(entry.name);
      }
    }

    console.log(chalk.dim(`[addons] Loaded ${this.addons.size} addon(s)`));
  }

  /**
   * Load a single addon by name
   */
  async loadAddon(name) {
    const addonPath = path.join(this.addonsDir, name, 'index.js');

    if (!existsSync(addonPath)) {
      console.log(chalk.yellow(`[addons] Skipping ${name}: no index.js found`));
      return;
    }

    try {
      const addon = await import(addonPath);

      if (!addon.metadata) {
        console.log(chalk.yellow(`[addons] Skipping ${name}: no metadata exported`));
        return;
      }

      this.addons.set(name, addon);

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
    } catch (error) {
      console.error(chalk.red(`[addons] Failed to load ${name}: ${error.message}`));
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
   */
  getActiveCommands() {
    const addon = this.getActive();
    if (!addon || !addon.commands) return {};

    const prefixed = {};
    for (const [phrase, action] of Object.entries(addon.commands)) {
      prefixed[`computer ${phrase}`] = action;
    }
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
   * List all loaded addons
   */
  list() {
    return Array.from(this.addons.entries()).map(([name, addon]) => ({
      name,
      ...addon.metadata,
    }));
  }
}

export { AddonLoader };
