/**
 * Speech2Type Electron GUI
 *
 * Menu bar (tray) application for controlling speech2type.
 * Shows animated status indicator and provides controls for the service.
 */

const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
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
const projectRoot = path.join(__dirname, '..');

// Config file path (same as speech2type uses)
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speech2type');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Icon cache
const icons = {};

/**
 * Create SVG-based tray icon
 * @param {string} state - idle, listening, speaking, processing, error, disabled
 * @param {number} frame - animation frame (0-3) for pulsing effect
 */
function createTrayIcon(state, frame = 0) {
  const size = 22;
  const cacheKey = `${state}-${frame}`;

  if (icons[cacheKey]) {
    return icons[cacheKey];
  }

  let svg;
  const pulseOpacity = (0.5 + (Math.sin(frame * Math.PI / 2) * 0.5)).toFixed(2); // Pulse between 0.5 and 1.0

  switch (state) {
    case 'listening':
      // Green microphone with pulse animation
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="#22c55e" opacity="${(pulseOpacity * 0.3).toFixed(2)}"/>
        <rect x="7" y="2" width="8" height="11" rx="4" fill="#22c55e"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="#22c55e" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="#22c55e" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="#22c55e" stroke-width="2"/>
      </svg>`;
      break;

    case 'speaking':
      // Blue with sound waves
      const wave1 = pulseOpacity;
      const wave2 = (1 - parseFloat(pulseOpacity)).toFixed(2);
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="11" rx="4" fill="#3b82f6"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="#3b82f6" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="#3b82f6" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="#3b82f6" stroke-width="2"/>
        <path d="M18 7 q3 4 0 8" stroke="#3b82f6" stroke-width="1.5" fill="none" opacity="${wave1}"/>
        <path d="M20 5 q4 6 0 12" stroke="#3b82f6" stroke-width="1.5" fill="none" opacity="${wave2}"/>
      </svg>`;
      break;

    case 'processing':
      // Yellow/orange processing indicator
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="11" rx="4" fill="#f59e0b"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="#f59e0b" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="#f59e0b" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="#f59e0b" stroke-width="2"/>
        <circle cx="11" cy="7" r="2" fill="white" opacity="${pulseOpacity}"/>
      </svg>`;
      break;

    case 'error':
      // Red microphone with X
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="11" rx="4" fill="#ef4444"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="#ef4444" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="#ef4444" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="#ef4444" stroke-width="2"/>
        <line x1="8" y1="5" x2="14" y2="11" stroke="white" stroke-width="2"/>
        <line x1="14" y1="5" x2="8" y2="11" stroke="white" stroke-width="2"/>
      </svg>`;
      break;

    case 'disabled':
      // Gray with slash
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="11" rx="4" fill="#6b7280"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="#6b7280" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="#6b7280" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="#6b7280" stroke-width="2"/>
        <line x1="4" y1="18" x2="18" y2="4" stroke="#ef4444" stroke-width="2"/>
      </svg>`;
      break;

    default: // idle
      // Gray microphone - template image for dark/light mode
      svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="11" rx="4" fill="black"/>
        <path d="M5 9 v2 a6 6 0 0 0 12 0 v-2" stroke="black" stroke-width="2" fill="none"/>
        <line x1="11" y1="17" x2="11" y2="20" stroke="black" stroke-width="2"/>
        <line x1="7" y1="20" x2="15" y2="20" stroke="black" stroke-width="2"/>
      </svg>`;
  }

  // Convert SVG to data URL for proper rendering
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const img = nativeImage.createFromDataURL(dataUrl);

  // Make idle icon a template image for proper dark/light mode support
  if (state === 'idle') {
    img.setTemplateImage(true);
  }

  // Resize for proper menu bar display (@2x for Retina)
  const resized = img.resize({ width: size, height: size, quality: 'best' });

  icons[cacheKey] = resized;
  return resized;
}

/**
 * Start icon animation for active states
 */
function startAnimation() {
  if (animationInterval) return;

  animationInterval = setInterval(() => {
    animationFrame = (animationFrame + 1) % 4;
    updateTrayIcon();
  }, 300);
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
      label: ttsEnabled ? '🔊 TTS Enabled' : '🔇 TTS Disabled',
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
 * Toggle listening state
 */
function toggleListening() {
  if (!isServiceRunning) return;

  isListening = !isListening;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());

  // Send signal to s2t process via IPC or file
  // For now, we'll use the hotkey mechanism
  console.log(`Listening: ${isListening}`);
}

/**
 * Set the current mode
 */
function setMode(mode) {
  currentMode = mode;
  tray.setContextMenu(buildContextMenu());
  updateTrayIcon();

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('mode-changed', mode);
  }

  console.log(`Mode set to: ${mode}`);
}

/**
 * Toggle TTS enabled state
 */
function toggleTTS() {
  if (ttsEnabled) {
    try {
      fs.unlinkSync(TTS_CONTROL_FILE);
    } catch (e) {}
    ttsEnabled = false;
  } else {
    fs.writeFileSync(TTS_CONTROL_FILE, '');
    ttsEnabled = true;
  }
  tray.setContextMenu(buildContextMenu());

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('tts-changed', ttsEnabled);
  }

  console.log(`TTS: ${ttsEnabled ? 'enabled' : 'disabled'}`);
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
    width: 500,
    height: 650,
    title: 'Speech2Type Settings',
    resizable: true,
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
 * Watch for TTS state changes
 */
function startStateWatcher() {
  setInterval(() => {
    const prevSpeaking = isSpeaking;
    checkTTSState();

    if (prevSpeaking !== isSpeaking) {
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    }
  }, 500);
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
ipcMain.on('set-mode', (event, mode) => setMode(mode));
ipcMain.on('set-tts', (event, enabled) => {
  if (enabled !== ttsEnabled) toggleTTS();
});
ipcMain.on('start-service', () => startS2T());
ipcMain.on('stop-service', () => stopS2T());
ipcMain.on('restart-service', () => restartS2T());

// App lifecycle
app.whenReady().then(() => {
  // Hide dock icon (menu bar app only)
  if (app.dock) {
    app.dock.hide();
  }

  // Create tray
  tray = new Tray(createTrayIcon('idle'));
  tray.setToolTip('Speech2Type');
  tray.setContextMenu(buildContextMenu());

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
