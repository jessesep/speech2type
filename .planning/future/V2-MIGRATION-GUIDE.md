# ONE v1.0 → v2.0 Migration Guide

> Strategic roadmap for evolving from foundation to future vision

## Executive Summary

This document provides a **practical migration path** from ONE v1.0 (Foundation) to v2.0+ (Future Vision), detailing:

- **Technical migration strategies** - How to evolve the codebase
- **Feature sequencing** - Which v2.0 features to build first
- **Backwards compatibility** - Ensuring v1.0 users aren't disrupted
- **Data migration** - Upgrading user configs and learned commands
- **Testing strategy** - Validating the migration
- **Rollback plans** - Safety nets if issues arise

**Target Audience:** Builder (implementation), Thinker (planning), Supervisor (oversight)

---

## Migration Philosophy

### Core Principle: **Gradual Evolution, Not Revolution**

```
v1.0 (Foundation)
    ↓ Add local STT option (parallel path)
v1.5 (Hybrid)
    ↓ Add adaptive learning (opt-in)
v2.0 (Local-First)
    ↓ Add cross-platform (Linux alpha)
v2.5 (Platform Expansion)
    ↓ Add full ecosystem
v3.0 (Intelligence + Ecosystem)
```

**Key Strategy:**
- New features are **additive**, not replacements
- Users can opt-in to v2.0 features gradually
- v1.0 functionality always works (fallback mode)
- No breaking changes to user configs

---

## Phase-by-Phase Migration Plan

### Phase L1: Local STT Foundation (v1.5, 3 months)

**Goal:** Add local speech-to-text as an **option** alongside cloud STT

#### Architecture Changes

```javascript
// BEFORE (v1.0): Single STT path
class TranscriptionService {
  async transcribe(audio) {
    return await this.deepgram.transcribe(audio);
  }
}

// AFTER (v1.5): Dual STT paths with mode selection
class TranscriptionService {
  constructor(config) {
    this.mode = config.stt_mode; // 'cloud' | 'local' | 'hybrid'
    this.cloud = new DeepgramSTT();
    this.local = new WhisperSTT(); // New!
  }

  async transcribe(audio) {
    switch (this.mode) {
      case 'cloud':
        return await this.cloud.transcribe(audio);

      case 'local':
        return await this.local.transcribe(audio);

      case 'hybrid':
        // Try local first, fallback to cloud
        try {
          const result = await this.local.transcribe(audio);
          if (result.confidence > 0.85) {
            return result;
          }
        } catch (err) {
          console.warn('Local STT failed, falling back to cloud');
        }
        return await this.cloud.transcribe(audio);
    }
  }
}
```

#### File Changes

**New Files:**
```
src/services/stt/
  ├── whisper-stt.js          # Local Whisper implementation
  ├── model-manager.js        # Download/manage Whisper models
  └── hybrid-stt.js           # Hybrid mode orchestration

native/
  └── whisper-node/           # Node.js bindings for whisper.cpp
      ├── binding.gyp
      ├── whisper_binding.cpp
      └── package.json
```

**Modified Files:**
```
src/index.js                  # Add local STT initialization
src/services/transcription.js # Refactor to support both modes
gui/settings.html             # Add STT mode selector
config/default.json           # Add stt_mode config
package.json                  # Add whisper.cpp dependencies
```

#### Configuration Migration

```javascript
// scripts/migrate-to-v1.5.js
const fs = require('fs').promises;
const path = require('path');

async function migrateConfig() {
  const configPath = path.join(os.homedir(), '.config/one/config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  // Add new v1.5 settings (preserve existing)
  config.stt = {
    mode: 'cloud',  // Default to cloud (existing behavior)
    local: {
      model: 'whisper-base',
      autoDownload: true
    },
    hybrid: {
      confidenceThreshold: 0.85,
      fallbackToCloud: true
    }
  };

  config.version = '1.5.0';

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log('Config migrated to v1.5');
}
```

#### User Experience

**First Launch After Upgrade:**
```
┌─────────────────────────────────────────────────────────────┐
│  ONE v1.5 - Now with Local Processing!                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  New in v1.5:                                                │
│  ✓ Local speech recognition (offline, faster, private)      │
│  ✓ Hybrid mode (local + cloud)                              │
│  ✓ Your choice: cloud, local, or hybrid                     │
│                                                              │
│  Your current mode: Cloud (same as before)                  │
│                                                              │
│  [Keep Cloud Mode] [Try Local Mode] [Learn More]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Testing Strategy

```yaml
test_plan:
  unit_tests:
    - WhisperSTT.transcribe()
    - ModelManager.download()
    - HybridSTT.fallback()

  integration_tests:
    - Cloud → Local migration
    - Hybrid mode switching
    - Model download flow

  performance_tests:
    - Local STT latency (<100ms target)
    - Model load time (<5s target)
    - Memory usage (acceptable on 8GB RAM)

  compatibility_tests:
    - v1.0 configs still work
    - Existing commands unchanged
    - API key migration
```

#### Rollback Plan

```javascript
// If local STT causes issues, easy rollback
if (user.reports_issue && issue.related_to === 'local_stt') {
  // Automatically switch back to cloud mode
  config.stt.mode = 'cloud';

  // Notify user
  notify('Switched to cloud mode due to issues. Local STT will improve in next update.');
}
```

---

### Phase L2: Adaptive Intelligence Foundation (v1.8, 3 months)

**Goal:** Add pattern detection and basic learning (opt-in)

#### Architecture Changes

```javascript
// New learning infrastructure
class LearningService {
  constructor() {
    this.enabled = false;  // Opt-in by default
    this.dataCollector = new DataCollector();
    this.patternDetector = new PatternDetector();
  }

  async initialize() {
    // Check if user has opted in
    const consent = await this.checkUserConsent();

    if (consent) {
      this.enabled = true;
      await this.dataCollector.start();
      await this.patternDetector.start();
    }
  }

  async checkUserConsent() {
    const config = await loadConfig();

    // If not yet asked, prompt user
    if (config.learning === undefined) {
      return await this.promptForConsent();
    }

    return config.learning.enabled;
  }
}
```

#### Data Storage

```
~/.config/one/
  └── learning/               # New directory (opt-in)
      ├── training_data.jsonl # Collected commands
      ├── patterns.json       # Detected patterns
      ├── corrections.jsonl   # User corrections
      └── stats.json          # Learning metrics
```

#### Privacy-First Migration

```javascript
// scripts/enable-learning.js
async function enableLearning() {
  // Show consent dialog
  const consent = await showConsentDialog({
    title: 'Enable Adaptive Learning?',
    message: `
      ONE can learn from your usage to become more helpful:

      ✓ Predict commands faster
      ✓ Suggest workflow automations
      ✓ Adapt to your vocabulary

      🔒 Privacy Promise:
      • All learning happens on YOUR device
      • NO data sent to cloud
      • You can delete all data anytime

      Enable learning?
    `,
    options: ['Enable', 'Not Now', 'Learn More']
  });

  if (consent === 'Enable') {
    // Create learning directory
    await fs.mkdir(learningDir, { recursive: true });

    // Initialize with empty files
    await fs.writeFile(
      path.join(learningDir, 'training_data.jsonl'),
      ''
    );

    // Update config
    config.learning = {
      enabled: true,
      collectTranscripts: true,
      collectCorrections: true,
      collectContext: true,
      retentionDays: 90
    };

    await saveConfig(config);
  }
}
```

---

### Phase E1: Ecosystem Foundation (v2.0, 2 months)

**Goal:** Enable command export/import and package format

#### Architecture Changes

```javascript
// New package system
class PackageManager {
  async exportCommands(selection) {
    const commands = await this.getCommands(selection);

    const exportData = {
      version: '1.0.0',
      type: 'command-collection',
      exported_at: new Date().toISOString(),
      exported_by: `ONE v${APP_VERSION}`,

      metadata: {
        name: 'My Commands',
        description: 'Exported from ONE',
        author: os.userInfo().username
      },

      commands: commands.map(cmd => ({
        id: cmd.id,
        phrases: cmd.phrases,
        action: cmd.action,
        context: cmd.context,
        created_at: cmd.created_at
      }))
    };

    return exportData;
  }

  async importCommands(packageData) {
    // Validate package format
    this.validatePackage(packageData);

    // Check for conflicts
    const conflicts = await this.detectConflicts(packageData.commands);

    // Prompt user for resolution
    const resolution = await this.promptConflictResolution(conflicts);

    // Import based on resolution
    for (const command of packageData.commands) {
      if (this.shouldImport(command, resolution)) {
        await this.dictionary.addCommand(command);
      }
    }
  }
}
```

#### File Format Evolution

```javascript
// v1.0: Simple personal_commands.json
{
  "version": "1.0.0",
  "commands": [...]
}

// v2.0: Extended format with packages
{
  "version": "2.0.0",
  "personal_commands": [...],
  "installed_packages": [
    {
      "id": "developer-essentials",
      "version": "2.1.0",
      "installed_at": "2025-12-01T10:00:00Z",
      "enabled": true
    }
  ],
  "package_overrides": {
    "developer-essentials": {
      "commands": {
        "ship-it": {
          "phrases": ["deploy it"],  // User customization
          "enabled": false  // User disabled this command
        }
      }
    }
  }
}
```

---

### Phase P1: Cross-Platform (Linux) (v2.1, 4 months)

**Goal:** Add Linux support while maintaining macOS compatibility

#### Platform Abstraction Layer

```javascript
// BEFORE (v1.0): macOS-specific code throughout
import { exec } from 'child_process';

async function focusApp(appName) {
  const script = `
    tell application "${appName}"
      activate
    end tell
  `;
  await exec(`osascript -e '${script}'`);
}

// AFTER (v2.1): Platform abstraction
class PlatformBridge {
  constructor() {
    this.platform = os.platform();
    this.impl = this.loadPlatformImpl();
  }

  loadPlatformImpl() {
    switch (this.platform) {
      case 'darwin':
        return new MacOSBridge();
      case 'linux':
        return new LinuxBridge();
      default:
        throw new Error(`Platform ${this.platform} not supported`);
    }
  }

  async focusApp(appName) {
    return await this.impl.focusApp(appName);
  }
}

// Platform-specific implementations
class MacOSBridge {
  async focusApp(appName) {
    // AppleScript implementation
  }
}

class LinuxBridge {
  async focusApp(appName) {
    // wmctrl/xdotool implementation
  }
}
```

#### File Structure

```
src/platforms/
  ├── index.js              # Platform detection & loading
  ├── base.js               # Abstract base class
  ├── macos/
  │   ├── audio.js         # CoreAudio
  │   ├── automation.js    # AppleScript
  │   ├── secrets.js       # Keychain
  │   └── window.js        # Accessibility API
  └── linux/
      ├── audio.js         # PipeWire/PulseAudio
      ├── automation.js    # xdotool/wmctrl
      ├── secrets.js       # libsecret
      └── window.js        # D-Bus/X11
```

#### Refactoring Strategy

```javascript
// Step 1: Identify platform-specific code
const platformSpecificFiles = [
  'src/services/audio-capture.js',
  'src/services/app-control.js',
  'src/services/secrets.js',
  'src/services/clipboard.js'
];

// Step 2: Extract to platform layer
for (const file of platformSpecificFiles) {
  // Extract interface
  const interfaceMethods = extractPublicMethods(file);

  // Create base class
  createAbstractBase(interfaceMethods);

  // Move current impl to macos/
  moveToMacOSPlatform(file);

  // Create stub for linux/
  createLinuxStub(interfaceMethods);
}

// Step 3: Update imports
updateImports(
  from: 'src/services/audio-capture.js',
  to: 'src/platforms/audio.js'
);
```

---

## Data Migration Strategies

### 1. Personal Dictionary Migration

```javascript
// Migrate v1.0 → v2.0 dictionary format
async function migrateDictionary() {
  const v1Dict = await loadV1Dictionary();

  const v2Dict = {
    version: '2.0.0',
    migrated_from: '1.0.0',
    migration_date: new Date().toISOString(),

    // Preserve v1 commands
    personal_commands: v1Dict.commands.map(cmd => ({
      ...cmd,
      // Add v2 metadata
      source: 'migrated_from_v1',
      confidence: cmd.success_count > 10 ? 1.0 : 0.8
    })),

    // New v2 fields
    installed_packages: [],
    workflows: extractWorkflowsFromCommands(v1Dict.commands),
    learning_data: {
      patterns: [],
      stats: initializeStats(v1Dict)
    }
  };

  // Backup v1 dictionary
  await fs.writeFile(
    dictionaryPath + '.v1.backup',
    JSON.stringify(v1Dict, null, 2)
  );

  // Write v2 dictionary
  await fs.writeFile(
    dictionaryPath,
    JSON.stringify(v2Dict, null, 2)
  );

  console.log('Dictionary migrated to v2.0');
}
```

### 2. Config Migration

```javascript
// Config version history
const configMigrations = {
  '1.0.0': (config) => config,  // No changes

  '1.5.0': (config) => ({
    ...config,
    stt: {
      mode: 'cloud',
      local: { model: 'whisper-base' },
      hybrid: { confidenceThreshold: 0.85 }
    }
  }),

  '1.8.0': (config) => ({
    ...config,
    learning: {
      enabled: false,  // Opt-in
      collectTranscripts: true,
      retentionDays: 90
    }
  }),

  '2.0.0': (config) => ({
    ...config,
    packages: {
      autoUpdate: true,
      allowedSources: ['official', 'community']
    },
    version: '2.0.0'
  })
};

// Auto-migration on startup
async function migrateConfig(currentVersion, targetVersion) {
  let config = await loadConfig();
  const configVersion = config.version || '1.0.0';

  // Apply migrations sequentially
  const versions = Object.keys(configMigrations).sort();

  for (const version of versions) {
    if (semver.gt(version, configVersion) && semver.lte(version, targetVersion)) {
      console.log(`Migrating config: ${configVersion} → ${version}`);
      config = configMigrations[version](config);
      config.version = version;
    }
  }

  await saveConfig(config);
  return config;
}
```

---

## Backwards Compatibility Strategy

### 1. Feature Flags

```javascript
// Feature flags for gradual rollout
const features = {
  LOCAL_STT: {
    enabled: process.env.ENABLE_LOCAL_STT === 'true',
    minVersion: '1.5.0',
    platforms: ['darwin', 'linux']
  },

  ADAPTIVE_LEARNING: {
    enabled: process.env.ENABLE_LEARNING === 'true',
    minVersion: '1.8.0',
    requiresConsent: true
  },

  PACKAGE_SYSTEM: {
    enabled: process.env.ENABLE_PACKAGES === 'true',
    minVersion: '2.0.0'
  }
};

// Check if feature available
function isFeatureAvailable(featureName) {
  const feature = features[featureName];

  if (!feature) return false;
  if (!feature.enabled) return false;
  if (semver.lt(APP_VERSION, feature.minVersion)) return false;
  if (feature.platforms && !feature.platforms.includes(os.platform())) return false;
  if (feature.requiresConsent && !hasUserConsent(featureName)) return false;

  return true;
}
```

### 2. Graceful Degradation

```javascript
// Handle missing features gracefully
async function transcribe(audio) {
  // Try local STT if available
  if (isFeatureAvailable('LOCAL_STT') && config.stt.mode === 'local') {
    try {
      return await this.localSTT.transcribe(audio);
    } catch (err) {
      console.warn('Local STT failed, falling back to cloud');
      // Fall through to cloud
    }
  }

  // Fallback to cloud (always available)
  return await this.cloudSTT.transcribe(audio);
}
```

### 3. API Versioning

```javascript
// Support multiple API versions
app.use('/api/v1', v1Router);  // Deprecated but supported
app.use('/api/v2', v2Router);  // Current

// v1 → v2 adapter
class APIAdapter {
  static v1ToV2(v1Request) {
    return {
      version: '2.0',
      command: v1Request.text,
      context: {
        app: v1Request.app_name,
        mode: v1Request.mode
      }
    };
  }

  static v2ToV1(v2Response) {
    return {
      action: v2Response.intent.action,
      confidence: v2Response.confidence,
      // Omit v2-only fields
    };
  }
}
```

---

## Testing Strategy

### 1. Migration Testing Matrix

```yaml
test_matrix:
  # Test all migration paths
  migrations:
    - from: v1.0.0
      to: v1.5.0
      tests:
        - Config migration preserves settings
        - Dictionary structure updated correctly
        - Local STT option added
        - Cloud mode still works

    - from: v1.5.0
      to: v2.0.0
      tests:
        - Learning data created if enabled
        - Package system initialized
        - Local STT settings preserved

    - from: v1.0.0
      to: v2.0.0
      tests:
        - Multi-version migration works
        - All intermediate migrations applied
        - No data loss

  # Platform compatibility
  platforms:
    - macos_intel
    - macos_apple_silicon
    - linux_ubuntu_22
    - linux_fedora_39

  # Backwards compatibility
  backwards_compat:
    - v1.0 commands work in v2.0
    - v1.0 configs work in v2.0
    - v1.0 API clients work with v2.0 server
```

### 2. Automated Migration Tests

```javascript
// tests/migration.test.js
describe('v1.0 → v2.0 Migration', () => {
  it('should migrate config without data loss', async () => {
    // Load v1.0 config fixture
    const v1Config = loadFixture('config.v1.0.json');

    // Run migration
    const v2Config = await migrateConfig(v1Config, '2.0.0');

    // Verify
    expect(v2Config.version).toBe('2.0.0');
    expect(v2Config.wake_word).toBe(v1Config.wake_word);
    expect(v2Config.api_keys).toBeDefined();
    expect(v2Config.stt).toBeDefined();
    expect(v2Config.learning).toBeDefined();
  });

  it('should migrate dictionary commands', async () => {
    const v1Dict = loadFixture('personal_commands.v1.0.json');
    const v2Dict = await migrateDictionary(v1Dict);

    expect(v2Dict.personal_commands.length).toBe(v1Dict.commands.length);
    expect(v2Dict.version).toBe('2.0.0');
  });

  it('should handle missing v1 fields gracefully', async () => {
    const partialV1Config = { wake_word: 'computer' };
    const v2Config = await migrateConfig(partialV1Config, '2.0.0');

    expect(v2Config.version).toBe('2.0.0');
    expect(v2Config.stt.mode).toBe('cloud');  // Default
  });
});
```

---

## Rollback Plans

### 1. Version Downgrade Support

```javascript
// Allow downgrading if v2.0 causes issues
async function downgradeToV1(reason) {
  console.log(`Downgrading to v1.0 due to: ${reason}`);

  // 1. Disable v2.0 features
  await disableFeature('LOCAL_STT');
  await disableFeature('ADAPTIVE_LEARNING');
  await disableFeature('PACKAGE_SYSTEM');

  // 2. Restore v1 config from backup
  const v1ConfigBackup = path.join(configDir, 'config.v1.backup.json');
  if (await fs.pathExists(v1ConfigBackup)) {
    await fs.copyFile(v1ConfigBackup, configPath);
  } else {
    // Generate minimal v1 config
    await generateV1Config();
  }

  // 3. Restore v1 dictionary from backup
  const v1DictBackup = path.join(configDir, 'personal_commands.v1.backup.json');
  if (await fs.pathExists(v1DictBackup)) {
    await fs.copyFile(v1DictBackup, dictionaryPath);
  }

  // 4. Notify user
  notify({
    title: 'Downgraded to v1.0',
    message: `ONE has been reverted to v1.0. Reason: ${reason}`
  });
}
```

### 2. Emergency Rollback Trigger

```javascript
// Auto-rollback if critical issues detected
class HealthMonitor {
  async checkHealth() {
    const issues = [];

    // Check if STT working
    if (!(await this.testSTT())) {
      issues.push('STT_FAILURE');
    }

    // Check if commands executing
    if (!(await this.testCommandExecution())) {
      issues.push('COMMAND_EXECUTION_FAILURE');
    }

    // Check crash rate
    const crashes = await this.getCrashCount(24 * 60 * 60 * 1000); // 24h
    if (crashes > 5) {
      issues.push('HIGH_CRASH_RATE');
    }

    // If critical issues, rollback
    if (issues.length > 0) {
      await this.emergencyRollback(issues);
    }
  }

  async emergencyRollback(issues) {
    console.error('EMERGENCY ROLLBACK TRIGGERED', issues);

    // Log to telemetry
    await logError({
      type: 'emergency_rollback',
      issues,
      version: APP_VERSION
    });

    // Downgrade to v1
    await downgradeToV1(`Critical issues: ${issues.join(', ')}`);

    // Restart app
    app.relaunch();
    app.exit(0);
  }
}
```

---

## Communication Strategy

### 1. User Notifications

```javascript
// Notify users of migration
async function notifyMigration(fromVersion, toVersion) {
  const releaseNotes = await fetchReleaseNotes(toVersion);

  const notification = {
    title: `ONE upgraded to v${toVersion}`,
    body: `
      ${releaseNotes.summary}

      New features:
      ${releaseNotes.features.map(f => `• ${f}`).join('\n')}

      Your data has been migrated automatically.
      Backup saved at: ~/.config/one/backups/
    `,
    actions: [
      { label: 'View Release Notes', action: 'open_url', url: releaseNotes.url },
      { label: 'OK', action: 'dismiss' }
    ]
  };

  await showNotification(notification);
}
```

### 2. Changelog Automation

```markdown
# Changelog

## [2.0.0] - 2026-01-15

### Added
- Local speech-to-text with Whisper.cpp (offline, faster)
- Adaptive learning (opt-in, privacy-first)
- Package system for command sharing
- Cross-platform support (Linux alpha)

### Changed
- Config format updated to v2.0 (auto-migrated)
- Dictionary format supports packages
- API versioned (v1 still supported)

### Migration Notes
- All v1.0 commands automatically migrated
- v1.0 configs backed up to ~/.config/one/backups/
- No action required - migration is automatic
- To rollback: Settings → Advanced → Downgrade to v1.0

### Breaking Changes
- None (fully backwards compatible)
```

---

## Performance Considerations

### 1. Lazy Loading

```javascript
// Don't load v2.0 features unless user enables them
class FeatureLoader {
  constructor() {
    this.loaded = new Set();
  }

  async loadFeature(featureName) {
    if (this.loaded.has(featureName)) {
      return;  // Already loaded
    }

    switch (featureName) {
      case 'LOCAL_STT':
        const { WhisperSTT } = await import('./services/stt/whisper-stt.js');
        this.localSTT = new WhisperSTT();
        await this.localSTT.initialize();
        break;

      case 'ADAPTIVE_LEARNING':
        const { LearningService } = await import('./services/learning.js');
        this.learning = new LearningService();
        await this.learning.initialize();
        break;

      case 'PACKAGE_SYSTEM':
        const { PackageManager } = await import('./services/packages.js');
        this.packages = new PackageManager();
        await this.packages.initialize();
        break;
    }

    this.loaded.add(featureName);
  }
}
```

### 2. Incremental Migration

```javascript
// Migrate data in background, not all at once
async function incrementalMigration() {
  const migrationState = await loadMigrationState();

  // Migrate in chunks (100 commands at a time)
  const CHUNK_SIZE = 100;
  const totalCommands = migrationState.total;
  const migratedSoFar = migrationState.migrated;

  if (migratedSoFar < totalCommands) {
    const chunk = await loadCommandChunk(migratedSoFar, CHUNK_SIZE);
    await migrateCommandChunk(chunk);

    migrationState.migrated += chunk.length;
    await saveMigrationState(migrationState);

    // Schedule next chunk
    setTimeout(() => incrementalMigration(), 1000);
  } else {
    // Migration complete!
    console.log('Migration complete');
    await finalizeMigration();
  }
}
```

---

## Success Metrics

### Migration Success Criteria

```yaml
success_metrics:
  # Technical success
  technical:
    - migration_completion_rate: "> 99%"
    - data_loss_incidents: "0"
    - rollback_rate: "< 1%"
    - post_migration_crash_rate: "< 0.1%"

  # User experience
  ux:
    - migration_time: "< 30 seconds"
    - user_reported_issues: "< 5%"
    - feature_adoption_rate: "> 20% within 30 days"
    - user_satisfaction: "> 4.5/5"

  # Performance
  performance:
    - startup_time_delta: "< 500ms slower"
    - memory_usage_delta: "< 100MB increase"
    - stt_latency_improvement: "> 50% (local mode)"
```

### Monitoring

```javascript
// Track migration metrics
class MigrationMetrics {
  async recordMigration(fromVersion, toVersion, success, duration) {
    const metric = {
      from_version: fromVersion,
      to_version: toVersion,
      success,
      duration_ms: duration,
      timestamp: Date.now(),
      platform: os.platform(),
      app_version: APP_VERSION
    };

    // Log locally
    await this.logMetric(metric);

    // Send to telemetry (if user opted in)
    if (config.telemetry.enabled) {
      await this.sendTelemetry(metric);
    }
  }
}
```

---

## Open Questions & Decisions Needed

### 1. Migration Timing

**Question:** Should migration happen on first launch after update, or in background?

**Options:**
- **A) Immediate on launch** - Blocks startup, but ensures consistency
- **B) Background after launch** - Faster startup, but potential race conditions
- **C) User-initiated** - Most flexible, but some users may never migrate

**Recommendation:** A (immediate on launch) with progress indicator

### 2. Backup Retention

**Question:** How long should we keep v1 backups?

**Options:**
- **A) 7 days** - Short term, encourages quick validation
- **B) 30 days** - Medium term, safer
- **C) Forever** - Maximum safety, more disk space

**Recommendation:** B (30 days) with option to keep longer

### 3. Feature Defaults

**Question:** Should new v2.0 features be opt-in or opt-out?

**Options:**
- **A) Opt-in** - Conservative, respects user choice
- **B) Opt-out** - Aggressive adoption, better UX for most
- **C) Hybrid** - Critical features opt-in, others opt-out

**Recommendation:** C (hybrid approach)
- Local STT: Opt-out (enable by default)
- Adaptive Learning: Opt-in (requires consent)
- Packages: Opt-out (enable by default)

---

## Implementation Checklist

### Before Migration

- [ ] Review FUTURE-VISION.md for feature dependencies
- [ ] Create comprehensive test suite
- [ ] Set up monitoring and rollback triggers
- [ ] Document all breaking changes
- [ ] Create user communication plan

### During Migration

- [ ] Run migration scripts
- [ ] Create backups of all user data
- [ ] Validate migrated data
- [ ] Test core functionality
- [ ] Monitor error rates

### After Migration

- [ ] Send migration success notification
- [ ] Monitor crash reports
- [ ] Collect user feedback
- [ ] Update documentation
- [ ] Plan for next migration (v2.0 → v2.5)

---

## Timeline

```
v1.0 Release (Jan 2025)
    ↓ 3 months
v1.5 Release (Apr 2025) - Local STT
    ↓ 3 months
v1.8 Release (Jul 2025) - Adaptive Learning
    ↓ 4 months
v2.0 Release (Nov 2025) - Ecosystem + Linux
    ↓ 6 months
v2.5 Release (May 2026) - Windows + Full Platform
```

---

## References

- [FUTURE-VISION.md](./FUTURE-VISION.md) - Overall v2.0+ vision
- [LOCAL-PROCESSING.md](./LOCAL-PROCESSING.md) - Local STT technical details
- [ECOSYSTEM-STRATEGY.md](./ECOSYSTEM-STRATEGY.md) - Package system design
- [CROSS-PLATFORM.md](./CROSS-PLATFORM.md) - Linux/Windows implementation
- [ADAPTIVE-INTELLIGENCE.md](./ADAPTIVE-INTELLIGENCE.md) - Learning features
- [../one/ROADMAP.md](../one/ROADMAP.md) - Current v1.0 development plan

---

*Last updated: 2025-12-08 by dreamer*
*Status: Ready for review by builder and thinker*
