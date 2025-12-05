/**
 * Speech2Type Electron GUI
 *
 * Menu bar (tray) application for controlling speech2type.
 * Shows status indicator and provides dropdown menu for controls.
 */

const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// State
let tray = null;
let mainWindow = null;
let s2tProcess = null;
let isListening = false;
let currentMode = 'general';
let ttsEnabled = false;

// Paths
const TTS_CONTROL_FILE = '/tmp/claude-auto-speak';
const projectRoot = path.join(__dirname, '..');

// Icons (we'll create simple ones using nativeImage)
function createIcon(color) {
  // Create a simple 22x22 icon (macOS menu bar size)
  const size = 22;
  const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" />
      <circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="white" opacity="0.8" />
    </svg>
  `;
  return nativeImage.createFromBuffer(
    Buffer.from(canvas),
    { width: size, height: size }
  );
}

// Icon states
const icons = {
  idle: null,      // Gray - not listening
  listening: null, // Green - actively listening
  speaking: null,  // Blue - TTS speaking
  error: null,     // Red - error state
};

function initIcons() {
  // For now, use template images that work well in menu bar
  // We'll create proper icons later
  icons.idle = createTrayIcon('idle');
  icons.listening = createTrayIcon('listening');
  icons.speaking = createTrayIcon('speaking');
  icons.error = createTrayIcon('error');
}

function createTrayIcon(state) {
  const size = 22;
  let svg;

  switch (state) {
    case 'listening':
      // Green microphone
      svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="12" rx="4" fill="#22c55e"/>
        <path d="M5 10 v2 a6 6 0 0 0 12 0 v-2" stroke="#22c55e" stroke-width="2" fill="none"/>
        <line x1="11" y1="18" x2="11" y2="20" stroke="#22c55e" stroke-width="2"/>
      </svg>`;
      break;
    case 'speaking':
      // Blue speaker
      svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="12" rx="4" fill="#3b82f6"/>
        <path d="M5 10 v2 a6 6 0 0 0 12 0 v-2" stroke="#3b82f6" stroke-width="2" fill="none"/>
        <line x1="11" y1="18" x2="11" y2="20" stroke="#3b82f6" stroke-width="2"/>
      </svg>`;
      break;
    case 'error':
      // Red microphone
      svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="12" rx="4" fill="#ef4444"/>
        <path d="M5 10 v2 a6 6 0 0 0 12 0 v-2" stroke="#ef4444" stroke-width="2" fill="none"/>
        <line x1="11" y1="18" x2="11" y2="20" stroke="#ef4444" stroke-width="2"/>
      </svg>`;
      break;
    default: // idle
      // Gray microphone (template image style)
      svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="2" width="8" height="12" rx="4" fill="#6b7280"/>
        <path d="M5 10 v2 a6 6 0 0 0 12 0 v-2" stroke="#6b7280" stroke-width="2" fill="none"/>
        <line x1="11" y1="18" x2="11" y2="20" stroke="#6b7280" stroke-width="2"/>
      </svg>`;
  }

  const img = nativeImage.createFromBuffer(Buffer.from(svg));
  // Make it template image for proper dark/light mode support on idle
  if (state === 'idle') {
    img.setTemplateImage(true);
  }
  return img;
}

function updateTrayIcon() {
  if (!tray) return;

  if (isListening) {
    tray.setImage(icons.listening);
    tray.setToolTip('Speech2Type - Listening...');
  } else {
    tray.setImage(icons.idle);
    tray.setToolTip('Speech2Type - Click to open menu');
  }
}

function checkTTSEnabled() {
  ttsEnabled = fs.existsSync(TTS_CONTROL_FILE);
  return ttsEnabled;
}

function buildContextMenu() {
  checkTTSEnabled();

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
      checked: currentMode === 'addon',
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
      label: isListening ? '🎤 Listening...' : '🎤 Start Listening',
      click: toggleListening,
      accelerator: 'Cmd+;'
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: modeSubmenu
    },
    { type: 'separator' },
    {
      label: ttsEnabled ? '🔊 TTS On' : '🔇 TTS Off',
      click: toggleTTS
    },
    { type: 'separator' },
    {
      label: 'Open Settings...',
      click: openSettings
    },
    { type: 'separator' },
    {
      label: 'Quit Speech2Type',
      click: () => {
        stopS2T();
        app.quit();
      },
      accelerator: 'Cmd+Q'
    }
  ];

  return Menu.buildFromTemplate(template);
}

function toggleListening() {
  // This will be connected to the actual s2t process
  // For now, toggle the state
  isListening = !isListening;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());

  // TODO: Send signal to s2t process to toggle listening
  console.log(`Listening: ${isListening}`);
}

function setMode(mode) {
  currentMode = mode;
  tray.setContextMenu(buildContextMenu());

  // TODO: Send command to s2t process
  console.log(`Mode set to: ${mode}`);
}

function toggleTTS() {
  if (ttsEnabled) {
    // Disable TTS
    try {
      fs.unlinkSync(TTS_CONTROL_FILE);
    } catch (e) {}
    ttsEnabled = false;
  } else {
    // Enable TTS
    fs.writeFileSync(TTS_CONTROL_FILE, '');
    ttsEnabled = true;
  }
  tray.setContextMenu(buildContextMenu());
  console.log(`TTS: ${ttsEnabled ? 'enabled' : 'disabled'}`);
}

function openSettings() {
  // Create settings window if needed
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Speech2Type Settings',
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'settings.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startS2T() {
  // Start the speech2type backend process
  // This is a placeholder - we'll integrate with the actual s2t
  console.log('Starting Speech2Type backend...');
}

function stopS2T() {
  if (s2tProcess) {
    s2tProcess.kill();
    s2tProcess = null;
  }
}

// App lifecycle
app.whenReady().then(() => {
  // Hide dock icon (menu bar app only)
  app.dock?.hide();

  // Initialize icons
  initIcons();

  // Create tray
  tray = new Tray(icons.idle);
  tray.setToolTip('Speech2Type');
  tray.setContextMenu(buildContextMenu());

  // Left-click toggles listening, right-click shows menu
  tray.on('click', () => {
    toggleListening();
  });

  // Start s2t backend
  startS2T();

  console.log('Speech2Type GUI started');
});

app.on('window-all-closed', () => {
  // Keep running in menu bar even if settings window is closed
});

app.on('before-quit', () => {
  stopS2T();
});

// Handle second instance
app.on('second-instance', () => {
  // Focus our window if we have one
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
