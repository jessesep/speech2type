/**
 * Speech2Type Electron GUI
 *
 * Menu bar (tray) application for controlling speech2type.
 * Shows animated status indicator and provides controls for the service.
 */

console.log('Starting Speech2Type GUI...');

const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const { createWriteStream, mkdirSync, cpSync, rmSync } = require('fs');
const { pipeline } = require('stream/promises');

console.log('Modules loaded');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
console.log('Got lock:', gotTheLock);
if (!gotTheLock) {
  console.log('Another instance is running, quitting...');
  app.quit();
}

// State
let tray = null;
let settingsWindow = null;
let s2tProcess = null;
let isListening = false;
let isServiceRunning = false;
let currentMode = 'general';
let ttsEnabled = false;
let isSpeaking = false;

// Animation state
let animationInterval = null;
let animationFrame = 0;

// Paths
const TTS_CONTROL_FILE = '/tmp/claude-auto-speak';
const TTS_SPEAKING_FILE = '/tmp/claude-tts-speaking';
const S2T_STATUS_FILE = '/tmp/s2t-status.json';
const S2T_COMMAND_FILE = '/tmp/s2t-command';

// Handle both development and packaged app paths
const isPackaged = app.isPackaged;
const projectRoot = isPackaged
  ? path.join(process.resourcesPath)
  : path.join(__dirname, '..');

// Config file path (same as speech2type uses)
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speech2type');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const ADDON_CONFIG_FILE = path.join(CONFIG_DIR, 'addons.json');
const HOTKEY_CONFIG_FILE = path.join(CONFIG_DIR, 'hotkeys.json');

// Default hotkey configuration
const DEFAULT_HOTKEYS = {
  toggle: { modifiers: ['cmd'], key: ';', description: 'Toggle listening' },
  toggleTTS: { modifiers: ['ctrl'], key: "'", description: "Toggle TTS" },
  pushToTalk: { modifiers: ['cmd', 'alt'], key: null, description: 'Push-to-talk (hold)' },
  stopTTS: { modifiers: [], key: '49', description: 'Stop TTS' },  // keycode 49 = space
};

// Mode launch config file
const MODE_LAUNCH_CONFIG_FILE = path.join(CONFIG_DIR, 'mode-launch.json');

// Default mode launch configuration
const DEFAULT_MODE_LAUNCH = {
  general: {
    enabled: false,
    processName: '',
    launchCommand: ''
  },
  music: {
    enabled: true,
    processName: 'Ableton Live',
    launchCommand: 'open -a "Ableton Live 12 Suite"'
  },
  claude: {
    enabled: true,
    processName: 'claude',
    launchCommand: 'osascript -e \'tell application "Terminal" to do script "claude --resume --dangerously-skip-permissions"\''
  }
};

// Icon cache
const icons = {};

/**
 * Create tray icon using nativeImage - Mode-specific animations
 * @param {string} state - idle, listening, speaking, processing, error, disabled
 * @param {number} frame - animation frame (0-15) for smooth wave animation
 */
function createTrayIcon(state, frame = 0) {
  const width = 16;
  const height = 16;
  const cacheKey = `${state}-${frame}-${currentMode}`;

  if (icons[cacheKey]) {
    return icons[cacheKey];
  }

  // Colors for different states (RGBA)
  const colorMap = {
    listening: [90, 200, 130, 255],   // Soft green
    speaking: [100, 160, 240, 255],   // Soft blue
    processing: [240, 180, 70, 255],  // Soft amber
    error: [230, 100, 100, 255],      // Soft red
    disabled: [120, 120, 120, 255],   // Gray
    idle: [0, 0, 0, 255]              // Black (template)
  };

  // Mode-specific colors when listening
  if (state === 'listening') {
    if (currentMode === 'claude') {
      colorMap.listening = [217, 119, 87, 255];  // Claude orange/terracotta
    } else if (currentMode === 'music') {
      colorMap.listening = [0, 210, 211, 255];   // Ableton teal/cyan
    }
  }

  const [r, g, b, a] = colorMap[state] || colorMap.idle;
  const isTemplate = state === 'idle';
  const isAnimated = state === 'listening' || state === 'speaking' || state === 'processing';

  const buffer = Buffer.alloc(width * height * 4);

  // Choose icon style based on mode
  if (currentMode === 'claude' && isAnimated) {
    // Claude mode: pulsing dot (AI/thinking indicator)
    drawClaudeIcon(buffer, width, height, r, g, b, a, frame);
  } else if (currentMode === 'music' && isAnimated) {
    // Music mode: bouncing bars (equalizer style)
    drawMusicIcon(buffer, width, height, r, g, b, a, frame);
  } else {
    // General mode: waveform bars
    drawWaveformIcon(buffer, width, height, r, g, b, a, frame, isAnimated);
  }

  const icon = nativeImage.createFromBuffer(buffer, { width, height });

  if (isTemplate) {
    icon.setTemplateImage(true);
  }

  icons[cacheKey] = icon;
  return icon;
}

/**
 * Draw waveform bars (general mode)
 */
function drawWaveformIcon(buffer, width, height, r, g, b, a, frame, isAnimated) {
  const barWidth = 2;
  const gap = 3;
  const totalWidth = 3 * barWidth + 2 * gap;
  const startX = Math.floor((width - totalWidth) / 2);
  const minH = 3;
  const maxH = 11;

  const getBarHeight = (barIndex) => {
    if (!isAnimated) {
      return [5, 8, 5][barIndex];
    }
    const phase = (frame / 16) * Math.PI * 2 + barIndex * 0.8;
    const wave = Math.sin(phase);
    return Math.round(minH + (maxH - minH) * (0.5 + wave * 0.45));
  };

  for (let barIndex = 0; barIndex < 3; barIndex++) {
    const barX = startX + barIndex * (barWidth + gap);
    const barHeight = getBarHeight(barIndex);
    const barTop = Math.floor((height - barHeight) / 2);

    for (let y = barTop; y < barTop + barHeight; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          let alpha = a;
          if (y === barTop || y === barTop + barHeight - 1) {
            alpha = Math.round(a * 0.7);
          }
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = alpha;
        }
      }
    }
  }
}

/**
 * Draw Claude mode icon - pulsing concentric circles (thinking/AI)
 */
function drawClaudeIcon(buffer, width, height, r, g, b, a, frame) {
  const centerX = width / 2;
  const centerY = height / 2;

  // Pulsing effect
  const pulse = Math.sin((frame / 16) * Math.PI * 2) * 0.3 + 0.7;
  const innerRadius = 2;
  const outerRadius = 5 + Math.sin((frame / 16) * Math.PI * 2) * 1.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * width + x) * 4;

      // Inner solid dot
      if (dist <= innerRadius) {
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = a;
      }
      // Outer pulsing ring
      else if (dist >= outerRadius - 1 && dist <= outerRadius + 0.5) {
        const ringAlpha = Math.round(a * pulse * 0.6);
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = ringAlpha;
      }
    }
  }
}

/**
 * Draw Music mode icon - equalizer bars bouncing
 */
function drawMusicIcon(buffer, width, height, r, g, b, a, frame) {
  // 4 thin bars like an equalizer
  const barWidth = 2;
  const gap = 2;
  const numBars = 4;
  const totalWidth = numBars * barWidth + (numBars - 1) * gap;
  const startX = Math.floor((width - totalWidth) / 2);
  const minH = 2;
  const maxH = 12;

  for (let barIndex = 0; barIndex < numBars; barIndex++) {
    // Each bar bounces with different phase
    const phase = (frame / 16) * Math.PI * 2 + barIndex * 1.2;
    const bounce = Math.abs(Math.sin(phase));
    const barHeight = Math.round(minH + (maxH - minH) * bounce);
    const barX = startX + barIndex * (barWidth + gap);
    const barTop = height - 2 - barHeight; // Anchor at bottom

    for (let y = barTop; y < barTop + barHeight; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          // Gradient from top (lighter) to bottom (full color)
          const gradientFactor = (y - barTop) / barHeight;
          const alpha = Math.round(a * (0.5 + gradientFactor * 0.5));
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = alpha;
        }
      }
    }
  }
}

/**
 * Start icon animation for active states
 */
function startAnimation() {
  if (animationInterval) return;

  animationInterval = setInterval(() => {
    animationFrame = (animationFrame + 1) % 16;
    updateTrayIcon();
  }, 80); // Smooth 16-frame animation
}

/**
 * Stop icon animation
 */
function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
    animationFrame = 0;
  }
}

/**
 * Update tray icon based on current state
 */
function updateTrayIcon() {
  if (!tray) return;

  let state = 'idle';
  let tooltip = 'Speech2Type';

  if (!isServiceRunning) {
    state = 'disabled';
    tooltip = 'Speech2Type - Service stopped';
    stopAnimation();
  } else if (isSpeaking) {
    state = 'speaking';
    tooltip = 'Speech2Type - Speaking...';
    startAnimation();
  } else if (isListening) {
    state = 'listening';
    tooltip = 'Speech2Type - Listening...';
    startAnimation();
  } else {
    state = 'idle';
    tooltip = `Speech2Type - ${currentMode} mode`;
    stopAnimation();
  }

  tray.setImage(createTrayIcon(state, animationFrame));
  tray.setToolTip(tooltip);
}

/**
 * Load mode launch configuration
 */
function loadModeLaunchConfig() {
  try {
    if (fs.existsSync(MODE_LAUNCH_CONFIG_FILE)) {
      const data = fs.readFileSync(MODE_LAUNCH_CONFIG_FILE, 'utf8');
      return { ...DEFAULT_MODE_LAUNCH, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load mode launch config:', e.message);
  }
  return { ...DEFAULT_MODE_LAUNCH };
}

/**
 * Save mode launch configuration
 */
function saveModeLaunchConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(MODE_LAUNCH_CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save mode launch config:', e.message);
  }
}

/**
 * Check if a process is running by name
 */
function isProcessRunning(processName) {
  if (!processName) return true; // No process to check
  try {
    const result = execSync(`pgrep -f "${processName}" 2>/dev/null || true`, { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Launch app for mode if not already running
 */
function launchAppForMode(mode) {
  const config = loadModeLaunchConfig();
  const modeConfig = config[mode];

  if (!modeConfig || !modeConfig.enabled || !modeConfig.launchCommand) {
    return;
  }

  // Check if process is already running
  if (modeConfig.processName && isProcessRunning(modeConfig.processName)) {
    console.log(`[mode-launch] ${modeConfig.processName} already running`);
    return;
  }

  // Launch the app
  console.log(`[mode-launch] Launching: ${modeConfig.launchCommand}`);
  exec(modeConfig.launchCommand, (err) => {
    if (err) {
      console.error(`[mode-launch] Failed to launch: ${err.message}`);
    }
  });
}

/**
 * Check current TTS state from file
 */
function checkTTSState() {
  ttsEnabled = fs.existsSync(TTS_CONTROL_FILE);
  isSpeaking = fs.existsSync(TTS_SPEAKING_FILE);
  return { ttsEnabled, isSpeaking };
}

/**
 * Load config from speech2type config file
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {};
}

/**
 * Save config to speech2type config file
 */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
}

/**
 * Load addon config (enabled/disabled states)
 */
function loadAddonConfig() {
  try {
    if (fs.existsSync(ADDON_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(ADDON_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load addon config:', e);
  }
  return { enabled: {} };
}

/**
 * Save addon config
 */
function saveAddonConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(ADDON_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save addon config:', e);
    return false;
  }
}

/**
 * Load hotkey configuration
 */
function loadHotkeyConfig() {
  try {
    if (fs.existsSync(HOTKEY_CONFIG_FILE)) {
      const data = fs.readFileSync(HOTKEY_CONFIG_FILE, 'utf8');
      return { ...DEFAULT_HOTKEYS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load hotkey config:', e);
  }
  return { ...DEFAULT_HOTKEYS };
}

/**
 * Save hotkey configuration
 */
function saveHotkeyConfig(hotkeys) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(HOTKEY_CONFIG_FILE, JSON.stringify(hotkeys, null, 2));
    return { success: true };
  } catch (e) {
    console.error('Failed to save hotkey config:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Format hotkey for display
 */
function formatHotkey(hotkey) {
  if (!hotkey || !hotkey.key) return 'Not set';
  const mods = hotkey.modifiers || [];
  const key = hotkey.key || '';
  const modStr = mods.map(m => {
    if (m === 'cmd') return 'Cmd';
    if (m === 'alt') return 'Option';
    if (m === 'ctrl') return 'Ctrl';
    if (m === 'shift') return 'Shift';
    return m;
  }).join('+');

  // Convert keycode to display name
  let keyDisplay = key;
  if (key === '39') keyDisplay = "'";
  else if (key === '49') keyDisplay = 'Space';
  else if (key === '41') keyDisplay = ';';

  return modStr ? `${modStr}+${keyDisplay}` : keyDisplay;
}

/**
 * Get list of all addons with their enabled state
 */
function getAddonsList() {
  const addonsDir = path.join(projectRoot, 'addons');
  const addonConfig = loadAddonConfig();
  const addons = [];

  try {
    if (!fs.existsSync(addonsDir)) {
      return addons;
    }

    const entries = fs.readdirSync(addonsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;

        // Skip hidden addons (removed from GUI but not deleted)
        if (addonConfig.hidden && addonConfig.hidden[name]) {
          continue;
        }

        const indexPath = path.join(addonsDir, entry.name, 'index.js');
        if (fs.existsSync(indexPath)) {
          // Read the file to extract metadata (simple regex approach for GUI)
          const content = fs.readFileSync(indexPath, 'utf8');

          // Extract metadata using regex (works for simple cases)
          const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
          const displayNameMatch = content.match(/displayName:\s*['"]([^'"]+)['"]/);
          const descriptionMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
          const modeCommandMatch = content.match(/modeCommand:\s*['"]([^'"]+)['"]/);
          const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);

          const enabled = addonConfig.enabled[name] !== false; // Default to enabled

          // Check for documentation file (README.md or docs.md)
          const addonDir = path.join(addonsDir, entry.name);
          let docsPath = null;
          if (fs.existsSync(path.join(addonDir, 'README.md'))) {
            docsPath = path.join(addonDir, 'README.md');
          } else if (fs.existsSync(path.join(addonDir, 'docs.md'))) {
            docsPath = path.join(addonDir, 'docs.md');
          }

          addons.push({
            name,
            displayName: displayNameMatch ? displayNameMatch[1] : name,
            description: descriptionMatch ? descriptionMatch[1] : null,
            modeCommand: modeCommandMatch ? modeCommandMatch[1] : null,
            version: versionMatch ? versionMatch[1] : '1.0.0',
            enabled,
            docsPath
          });
        }
      }
    }
  } catch (e) {
    console.error('Failed to list addons:', e);
  }

  return addons;
}

/**
 * Toggle an addon's enabled state
 */
function toggleAddon(name, enabled) {
  const config = loadAddonConfig();
  config.enabled[name] = enabled;
  return saveAddonConfig(config);
}

/**
 * Import addon from GitHub URL
 * Supports: https://github.com/user/repo or https://github.com/user/repo/tree/branch/path
 */
async function importAddonFromGithub(url) {
  try {
    // Parse GitHub URL
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/);
    if (!match) {
      return { success: false, error: 'Invalid GitHub URL' };
    }

    const [, owner, repo, branch = 'main', subpath = ''] = match;
    const repoName = repo.replace(/\.git$/, '');

    // Download as zip
    const zipUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/${branch}.zip`;
    const tempDir = path.join(require('os').tmpdir(), `s2t-addon-${Date.now()}`);
    const zipPath = path.join(tempDir, 'addon.zip');

    mkdirSync(tempDir, { recursive: true });

    // Download zip file
    await new Promise((resolve, reject) => {
      const download = (downloadUrl) => {
        https.get(downloadUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            download(response.headers.location);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          const file = createWriteStream(zipPath);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      };
      download(zipUrl);
    });

    // Extract zip using unzip command (available on macOS)
    execSync(`unzip -q "${zipPath}" -d "${tempDir}"`);

    // Find the extracted folder
    const extractedDir = path.join(tempDir, `${repoName}-${branch}`);
    const sourceDir = subpath ? path.join(extractedDir, subpath) : extractedDir;

    // Verify it's a valid addon (has index.js)
    if (!fs.existsSync(path.join(sourceDir, 'index.js'))) {
      rmSync(tempDir, { recursive: true, force: true });
      return { success: false, error: 'No index.js found in addon' };
    }

    // Determine addon name from metadata or folder
    let addonName = repoName;
    try {
      const indexContent = fs.readFileSync(path.join(sourceDir, 'index.js'), 'utf8');
      const nameMatch = indexContent.match(/name:\s*['"]([^'"]+)['"]/);
      if (nameMatch) addonName = nameMatch[1];
    } catch (e) {}

    // Copy to addons directory
    const addonsDir = path.join(projectRoot, 'addons');
    const destDir = path.join(addonsDir, addonName);

    if (fs.existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true });
    }

    cpSync(sourceDir, destDir, { recursive: true });

    // Cleanup temp
    rmSync(tempDir, { recursive: true, force: true });

    return { success: true, name: addonName };
  } catch (error) {
    console.error('GitHub import error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import addon from local folder or zip
 */
async function importAddonFromLocal() {
  const result = await dialog.showOpenDialog({
    title: 'Import Addon',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Addon', extensions: ['zip'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false };
  }

  const sourcePath = result.filePaths[0];
  const isZip = sourcePath.endsWith('.zip');
  const tempDir = path.join(require('os').tmpdir(), `s2t-addon-${Date.now()}`);

  try {
    let sourceDir = sourcePath;

    if (isZip) {
      // Extract zip
      mkdirSync(tempDir, { recursive: true });
      execSync(`unzip -q "${sourcePath}" -d "${tempDir}"`);

      // Find extracted content (might be in a subfolder)
      const entries = fs.readdirSync(tempDir);
      if (entries.length === 1 && fs.statSync(path.join(tempDir, entries[0])).isDirectory()) {
        sourceDir = path.join(tempDir, entries[0]);
      } else {
        sourceDir = tempDir;
      }
    }

    // Verify it's a valid addon
    if (!fs.existsSync(path.join(sourceDir, 'index.js'))) {
      if (isZip) rmSync(tempDir, { recursive: true, force: true });
      return { success: false, error: 'No index.js found in addon' };
    }

    // Get addon name
    let addonName = path.basename(sourceDir);
    try {
      const indexContent = fs.readFileSync(path.join(sourceDir, 'index.js'), 'utf8');
      const nameMatch = indexContent.match(/name:\s*['"]([^'"]+)['"]/);
      if (nameMatch) addonName = nameMatch[1];
    } catch (e) {}

    // Copy to addons directory
    const addonsDir = path.join(projectRoot, 'addons');
    const destDir = path.join(addonsDir, addonName);

    if (fs.existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true });
    }

    cpSync(sourceDir, destDir, { recursive: true });

    // Cleanup temp if zip
    if (isZip) rmSync(tempDir, { recursive: true, force: true });

    return { success: true, name: addonName };
  } catch (error) {
    console.error('Local import error:', error);
    if (isZip) rmSync(tempDir, { recursive: true, force: true });
    return { success: false, error: error.message };
  }
}

/**
 * Get addon settings from config
 */
function getAddonSettings(addonName) {
  const config = loadAddonConfig();
  const settings = config.settings?.[addonName] || {};

  // Also read defaults from the addon's index.js
  const addonsDir = path.join(projectRoot, 'addons');
  const indexPath = path.join(addonsDir, addonName, 'index.js');

  let defaults = {
    commandsOnly: false,
    pushToTalk: false,
    ttsEnabled: false,
    customCommands: {}
  };

  try {
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      if (content.includes('commandsOnly: true')) defaults.commandsOnly = true;
      if (content.includes('pushToTalk: true')) defaults.pushToTalk = true;
      if (content.includes('ttsEnabled: true')) defaults.ttsEnabled = true;
    }
  } catch (e) {}

  return { ...defaults, ...settings };
}

/**
 * Save addon settings to config
 */
function saveAddonSettings(addonName, settings) {
  try {
    const config = loadAddonConfig();
    if (!config.settings) config.settings = {};
    config.settings[addonName] = settings;
    saveAddonConfig(config);

    // Notify backend to reload (write to command file)
    fs.writeFileSync('/tmp/s2t-gui-command', 'reload-addons');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new addon from template
 */
function createAddon({ name, displayName, modeCommand, description, commandsOnly, pushToTalk, ttsEnabled }) {
  try {
    const addonsDir = path.join(projectRoot, 'addons');
    const addonDir = path.join(addonsDir, name);

    if (fs.existsSync(addonDir)) {
      return { success: false, error: 'Addon already exists' };
    }

    fs.mkdirSync(addonDir, { recursive: true });

    const template = `/**
 * ${displayName || name} Addon
 * ${description || 'Custom addon for Speech2Type'}
 */

export const metadata = {
  name: '${name}',
  displayName: '${displayName || name}',
  version: '1.0.0',
  description: '${description || ''}',
  modeCommand: '${modeCommand}',
  modeAliases: ['${modeCommand}'],
  pushToTalk: ${pushToTalk},
  pushToTalkAutoSubmit: ${pushToTalk},
  commandsOnly: ${commandsOnly},
  ttsEnabled: ${ttsEnabled},
};

// Called when addon is activated
export function init() {
  console.log('[${name}] Initialized');
}

// Called when switching away from this mode
export function cleanup() {
  console.log('[${name}] Cleaned up');
}

// Voice commands (phrases are prefixed with "computer" automatically)
export const commands = {
  // Add your commands here:
  // 'do something': 'my_action',
};

// Pattern-based commands (for dynamic values like numbers)
export const patterns = [
  // Example: "computer set value 50" -> captures 50
  // {
  //   pattern: /set value (\\d+)/i,
  //   action: 'set_value',
  //   extract: (match) => parseInt(match[1])
  // },
];

// Handle command execution
export async function execute(action, value) {
  switch (action) {
    // case 'my_action':
    //   console.log('Doing my action!');
    //   return true;
    default:
      return false;
  }
}
`;

    fs.writeFileSync(path.join(addonDir, 'index.js'), template);

    // Create a basic README
    const readme = `# ${displayName || name}

${description || 'Custom addon for Speech2Type Enhanced.'}

## Activation

Say **"computer ${modeCommand}"** to activate this mode.

## Commands

Add your custom commands in \`index.js\`.

## Options

- Commands Only: ${commandsOnly ? 'Yes' : 'No'}
- Push-to-Talk: ${pushToTalk ? 'Yes' : 'No'}
- TTS Enabled: ${ttsEnabled ? 'Yes' : 'No'}
`;

    fs.writeFileSync(path.join(addonDir, 'README.md'), readme);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export addon as zip
 */
async function exportAddon(addonName) {
  const addonsDir = path.join(projectRoot, 'addons');
  const addonDir = path.join(addonsDir, addonName);

  if (!fs.existsSync(addonDir)) {
    return { success: false, error: 'Addon not found' };
  }

  const result = await dialog.showSaveDialog({
    title: 'Export Addon',
    defaultPath: `${addonName}.zip`,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  try {
    // Create zip using ditto (macOS) for better compatibility
    execSync(`cd "${addonsDir}" && zip -r "${result.filePath}" "${addonName}"`);
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build the context menu
 */
function buildContextMenu() {
  checkTTSState();

  const statusLabel = isServiceRunning
    ? (isListening ? '● Listening' : '○ Ready')
    : '○ Stopped';

  const modeSubmenu = [
    {
      label: 'General',
      type: 'radio',
      checked: currentMode === 'general',
      click: () => setMode('general')
    },
    {
      label: 'Music (Ableton)',
      type: 'radio',
      checked: currentMode === 'music',
      click: () => setMode('music')
    },
    {
      label: 'Claude (Power)',
      type: 'radio',
      checked: currentMode === 'claude',
      click: () => setMode('claude')
    }
  ];

  const template = [
    {
      label: statusLabel,
      enabled: false
    },
    { type: 'separator' },
    {
      label: isListening ? 'Stop Listening' : 'Start Listening',
      click: toggleListening,
      enabled: isServiceRunning,
      accelerator: 'CmdOrCtrl+;'
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: modeSubmenu,
      enabled: isServiceRunning
    },
    {
      label: ttsEnabled ? 'TTS Enabled' : 'TTS Disabled',
      type: 'checkbox',
      checked: ttsEnabled,
      click: toggleTTS
    },
    { type: 'separator' },
    {
      label: isServiceRunning ? 'Restart Service' : 'Start Service',
      click: isServiceRunning ? restartS2T : startS2T
    },
    {
      label: 'Stop Service',
      click: stopS2T,
      enabled: isServiceRunning
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: openSettings,
      accelerator: 'CmdOrCtrl+,'
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopS2T();
        app.quit();
      },
      accelerator: 'CmdOrCtrl+Q'
    }
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Send command to s2t backend via shared file
 */
function sendCommand(command) {
  const commandFile = '/tmp/s2t-gui-command';
  try {
    fs.writeFileSync(commandFile, command);
    console.log(`[gui] Sent command: ${command}`);
  } catch (e) {
    console.error('Failed to send command:', e);
  }
}

/**
 * Toggle listening state
 */
function toggleListening() {
  if (!isServiceRunning) return;

  sendCommand('toggle');
}

/**
 * Set the current mode
 */
function setMode(mode) {
  currentMode = mode;
  tray.setContextMenu(buildContextMenu());
  updateTrayIcon();

  // Send mode change to backend
  sendCommand(`mode:${mode}`);

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('mode-changed', mode);
  }
}

/**
 * Toggle TTS enabled state
 */
function toggleTTS() {
  // Check actual file state first
  const currentlyEnabled = fs.existsSync(TTS_CONTROL_FILE);

  if (currentlyEnabled) {
    try {
      fs.unlinkSync(TTS_CONTROL_FILE);
    } catch (e) {}
    ttsEnabled = false;
    console.log('TTS: disabled (GUI)');
  } else {
    fs.writeFileSync(TTS_CONTROL_FILE, '');
    ttsEnabled = true;
    console.log('TTS: enabled (GUI)');
  }

  // Also notify the backend via command file so it updates its state
  try {
    fs.writeFileSync('/tmp/s2t-gui-command', 'sync-tts');
  } catch (e) {}

  tray.setContextMenu(buildContextMenu());

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('tts-changed', ttsEnabled);
  }
}

/**
 * Start the speech2type backend service
 */
function startS2T() {
  if (s2tProcess) {
    console.log('Service already running');
    return;
  }

  console.log('Starting Speech2Type service...');

  const s2tPath = path.join(projectRoot, 'bin', 'speech2type.js');

  s2tProcess = spawn('node', [s2tPath, 'start', '--auto'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  s2tProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[s2t]', output);

    // Parse status from output
    if (output.includes('Started listening')) {
      isListening = true;
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    } else if (output.includes('Stopped listening')) {
      isListening = false;
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    }
  });

  s2tProcess.stderr.on('data', (data) => {
    console.error('[s2t error]', data.toString());
  });

  s2tProcess.on('close', (code) => {
    console.log(`Speech2Type service exited with code ${code}`);
    s2tProcess = null;
    isServiceRunning = false;
    isListening = false;
    updateTrayIcon();
    tray.setContextMenu(buildContextMenu());
  });

  isServiceRunning = true;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());
}

/**
 * Stop the speech2type backend service
 */
function stopS2T() {
  if (s2tProcess) {
    console.log('Stopping Speech2Type service...');
    s2tProcess.kill('SIGTERM');
    s2tProcess = null;
  }
  isServiceRunning = false;
  isListening = false;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());
}

/**
 * Restart the speech2type backend service
 */
function restartS2T() {
  stopS2T();
  setTimeout(startS2T, 500);
}

/**
 * Open the settings window
 */
function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 750,
    title: 'Speech2Type Settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#00000000'
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Watch for state changes from backend
 */
function startStateWatcher() {
  setInterval(() => {
    const prevSpeaking = isSpeaking;
    const prevListening = isListening;
    const prevTTS = ttsEnabled;
    const prevMode = currentMode;

    checkTTSState();

    // Read status from backend
    try {
      if (fs.existsSync(S2T_STATUS_FILE)) {
        const status = JSON.parse(fs.readFileSync(S2T_STATUS_FILE, 'utf8'));
        isListening = status.listening;
        if (status.mode === 'addon') {
          currentMode = 'music';
        } else {
          currentMode = status.mode;
        }
        // Sync TTS from actual file, not status.json (more reliable)
        ttsEnabled = fs.existsSync(TTS_CONTROL_FILE);
      }
    } catch (e) {
      // Ignore read errors
    }

    const stateChanged = prevSpeaking !== isSpeaking ||
                         prevListening !== isListening ||
                         prevTTS !== ttsEnabled ||
                         prevMode !== currentMode;

    if (stateChanged) {
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());

      // Notify settings window of all state changes
      if (settingsWindow) {
        // Send unified state update for consistency
        settingsWindow.webContents.send('state-changed', {
          isListening,
          isServiceRunning,
          currentMode,
          ttsEnabled
        });
      }
    }
  }, 300);
}

// IPC handlers for settings window
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (event, config) => saveConfig(config));
ipcMain.handle('get-state', () => ({
  isListening,
  isServiceRunning,
  currentMode,
  ttsEnabled,
  isSpeaking
}));
ipcMain.handle('get-addons', () => getAddonsList());
ipcMain.handle('get-addon-commands', (event, addonName) => {
  try {
    const addonPath = path.join(projectRoot, 'addons', addonName, 'index.js');
    const builtInCommands = {};
    const customCommands = {};

    if (fs.existsSync(addonPath)) {
      const content = fs.readFileSync(addonPath, 'utf8');

      // Find "export const commands = {" or "const commands = {"
      const startMatch = content.match(/(?:export\s+)?(?:const|let|var)\s+commands\s*=\s*\{/);
      if (startMatch) {
        const startIdx = startMatch.index + startMatch[0].length;
        // Find the matching closing brace by counting
        let braceCount = 1;
        let endIdx = startIdx;
        for (let i = startIdx; i < content.length && braceCount > 0; i++) {
          if (content[i] === '{') braceCount++;
          else if (content[i] === '}') braceCount--;
          endIdx = i;
        }
        const commandsStr = content.substring(startIdx, endIdx);

        // Match patterns like 'phrase': 'action' or "phrase": "action"
        const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(commandsStr)) !== null) {
          builtInCommands[match[1]] = match[2];
        }
      }
    }

    // Get custom commands from settings
    const addonConfig = loadAddonConfig();
    const settings = addonConfig.settings?.[addonName] || {};
    if (settings.customCommands) {
      for (const [phrase, action] of Object.entries(settings.customCommands)) {
        customCommands[phrase] = action;
      }
    }

    return { builtIn: builtInCommands, custom: customCommands };
  } catch (e) {
    console.error(`Failed to get addon commands: ${e.message}`);
    return { builtIn: {}, custom: {} };
  }
});
ipcMain.handle('toggle-addon', (event, { name, enabled }) => toggleAddon(name, enabled));
ipcMain.handle('import-addon-github', (event, url) => importAddonFromGithub(url));
ipcMain.handle('import-addon-local', () => importAddonFromLocal());
ipcMain.handle('export-addon', (event, addonName) => exportAddon(addonName));
ipcMain.handle('get-addon-settings', (event, addonName) => getAddonSettings(addonName));
ipcMain.handle('save-addon-settings', (event, { name, settings }) => saveAddonSettings(name, settings));
ipcMain.handle('remove-addon', (event, name) => {
  try {
    // Instead of deleting, mark the addon as hidden in the config
    const config = loadAddonConfig();
    if (!config.hidden) config.hidden = {};
    config.hidden[name] = true;
    config.enabled[name] = false; // Also disable it
    saveAddonConfig(config);
    console.log(`[addons] Hidden addon: ${name}`);
    return { success: true };
  } catch (e) {
    console.error(`[addons] Failed to hide addon: ${e.message}`);
    return { success: false, error: e.message };
  }
});
ipcMain.handle('create-addon', (event, options) => createAddon(options));
ipcMain.handle('get-hotkeys', () => loadHotkeyConfig());
ipcMain.handle('save-hotkeys', (event, hotkeys) => saveHotkeyConfig(hotkeys));
ipcMain.handle('reset-hotkeys', () => {
  // Delete the config file to reset to defaults
  try {
    if (fs.existsSync(HOTKEY_CONFIG_FILE)) {
      fs.unlinkSync(HOTKEY_CONFIG_FILE);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('format-hotkey', (event, hotkey) => formatHotkey(hotkey));
ipcMain.on('open-addon-docs', (event, docsPath) => {
  // Open the markdown file with the default app (or show in Finder)
  shell.openPath(docsPath);
});
ipcMain.on('set-mode', (event, mode) => setMode(mode));
ipcMain.on('set-tts', (event, enabled) => {
  console.log('Received set-tts:', enabled, 'current:', ttsEnabled);
  toggleTTS();
});
ipcMain.on('start-service', () => startS2T());
ipcMain.on('stop-service', () => stopS2T());
ipcMain.on('restart-service', () => restartS2T());

// Listening controls (toggle voice recognition without stopping service)
ipcMain.on('start-listening', () => {
  try {
    fs.writeFileSync('/tmp/s2t-gui-command', 'start');
    console.log('Sent start listening command');
  } catch (e) {
    console.error('Failed to send start command:', e);
  }
});

ipcMain.on('stop-listening', () => {
  try {
    fs.writeFileSync('/tmp/s2t-gui-command', 'stop');
    console.log('Sent stop listening command');
  } catch (e) {
    console.error('Failed to send stop command:', e);
  }
});
ipcMain.on('open-external', (event, url) => shell.openExternal(url));

// App lifecycle
app.whenReady().then(() => {
  console.log('App ready, creating tray...');

  // Hide dock icon (menu bar app only)
  if (app.dock) {
    app.dock.hide();
    console.log('Dock icon hidden');
  }

  // Create tray
  try {
    const icon = createTrayIcon('idle');
    console.log('Icon created:', icon ? 'success' : 'failed');
    console.log('Icon empty?', icon.isEmpty());

    tray = new Tray(icon);
    console.log('Tray created');

    tray.setToolTip('Speech2Type');
    tray.setContextMenu(buildContextMenu());
    console.log('Context menu set');
  } catch (err) {
    console.error('Error creating tray:', err);
  }

  // Click behavior: left-click shows menu (standard macOS behavior)
  // Could change to toggle listening with: tray.on('click', toggleListening);

  // Start watching for state changes
  startStateWatcher();

  // Auto-start the service
  startS2T();

  console.log('Speech2Type GUI started');
});

app.on('window-all-closed', () => {
  // Keep running in menu bar even if settings window is closed
});

app.on('before-quit', () => {
  stopS2T();
  stopAnimation();
});

// Handle second instance
app.on('second-instance', () => {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
  }
});
