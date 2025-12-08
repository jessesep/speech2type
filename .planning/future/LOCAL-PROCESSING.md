# Local Processing Deep Dive

> Technical specification for offline-first voice processing in ONE v2.0

## Overview

This document provides detailed technical guidance for implementing local speech-to-text and intent classification in ONE, moving from cloud-dependent processing to a hybrid-local architecture.

---

## Speech-to-Text: Model Comparison

### Whisper Family (OpenAI)

The Whisper family offers excellent accuracy with varying size/speed tradeoffs.

| Model | Parameters | Size | VRAM | Latency (M1) | WER (English) |
|-------|------------|------|------|--------------|---------------|
| tiny | 39M | 75MB | ~1GB | ~50ms | 12.5% |
| base | 74M | 145MB | ~1GB | ~100ms | 9.1% |
| small | 244M | 488MB | ~2GB | ~200ms | 7.6% |
| medium | 769M | 1.5GB | ~5GB | ~500ms | 6.5% |
| large-v3 | 1.55B | 3.1GB | ~10GB | ~1s+ | 5.2% |

**Recommendation:** `whisper-base` for default, `whisper-small` for high-accuracy mode.

### Moonshine (Useful Sensors)

Moonshine is optimized for real-time voice command scenarios.

| Model | Parameters | Size | Latency (M1) | WER (Commands) |
|-------|------------|------|--------------|----------------|
| tiny | ~25M | 52MB | ~30ms | ~15% |
| base | ~60M | 130MB | ~60ms | ~10% |

**Advantage:** Lower latency, optimized for short utterances.
**Disadvantage:** Less accurate for complex sentences.

**Recommendation:** Use Moonshine for wake word detection and quick commands, Whisper for training mode conversations.

### Distil-Whisper

Distilled versions that maintain accuracy with better speed.

| Model | Size | Latency | WER |
|-------|------|---------|-----|
| distil-small.en | 166MB | ~80ms | 9.3% |
| distil-medium.en | 394MB | ~150ms | 7.8% |

**Recommendation:** Consider `distil-small.en` as default - good balance.

---

## Implementation Architecture

### Native Addon Approach

```cpp
// native/whisper-node/whisper_binding.cpp
#include <napi.h>
#include "whisper.h"

class WhisperWorker : public Napi::AsyncWorker {
public:
    WhisperWorker(
        Napi::Function& callback,
        whisper_context* ctx,
        std::vector<float>& audio
    ) : Napi::AsyncWorker(callback), ctx_(ctx), audio_(audio) {}

    void Execute() override {
        whisper_full_params params = whisper_full_default_params(
            WHISPER_SAMPLING_GREEDY
        );
        params.n_threads = 4;
        params.language = "en";
        params.suppress_non_speech_tokens = true;

        if (whisper_full(ctx_, params, audio_.data(), audio_.size()) != 0) {
            SetError("Transcription failed");
            return;
        }

        const int n_segments = whisper_full_n_segments(ctx_);
        for (int i = 0; i < n_segments; ++i) {
            result_ += whisper_full_get_segment_text(ctx_, i);
        }
    }

    void OnOK() override {
        Napi::HandleScope scope(Env());
        Callback().Call({Env().Null(), Napi::String::New(Env(), result_)});
    }

private:
    whisper_context* ctx_;
    std::vector<float> audio_;
    std::string result_;
};
```

### Node.js Wrapper

```javascript
// src/services/local-stt.js
const whisper = require('../native/whisper-node');

class LocalSTT {
  constructor(options = {}) {
    this.model = options.model || 'base';
    this.modelPath = this.getModelPath(this.model);
    this.ctx = null;
    this.ready = false;
  }

  async initialize() {
    console.log(`Loading Whisper ${this.model} model...`);
    const startTime = Date.now();

    this.ctx = await whisper.createContext(this.modelPath);
    this.ready = true;

    console.log(`Model loaded in ${Date.now() - startTime}ms`);
  }

  async transcribe(audioBuffer, options = {}) {
    if (!this.ready) {
      throw new Error('Model not initialized');
    }

    const floatAudio = this.convertToFloat32(audioBuffer);

    const result = await whisper.transcribe(this.ctx, floatAudio, {
      language: options.language || 'en',
      threads: options.threads || 4,
      maxLen: options.maxLen || 30,  // seconds
    });

    return {
      text: result.text.trim(),
      segments: result.segments,
      duration: result.duration,
    };
  }

  convertToFloat32(buffer) {
    // Convert from 16-bit PCM to float32
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    return samples;
  }

  getModelPath(model) {
    const modelDir = process.env.ONE_MODEL_DIR ||
      path.join(os.homedir(), '.config', 'one', 'models');
    return path.join(modelDir, `ggml-${model}.bin`);
  }

  async shutdown() {
    if (this.ctx) {
      await whisper.freeContext(this.ctx);
      this.ctx = null;
      this.ready = false;
    }
  }
}

module.exports = { LocalSTT };
```

---

## Voice Activity Detection (VAD)

Before transcription, detect when speech actually occurs to avoid processing silence.

### Silero VAD (Recommended)

```javascript
// src/services/vad.js
const ort = require('onnxruntime-node');

class SileroVAD {
  constructor() {
    this.session = null;
    this.sampleRate = 16000;
    this.windowSamples = 512;  // 32ms at 16kHz
    this.threshold = 0.5;
    this.h = null;
    this.c = null;
  }

  async initialize() {
    this.session = await ort.InferenceSession.create(
      path.join(__dirname, '../models/silero_vad.onnx')
    );

    // Initialize LSTM state
    this.h = new ort.Tensor('float32', new Float32Array(2 * 64), [2, 1, 64]);
    this.c = new ort.Tensor('float32', new Float32Array(2 * 64), [2, 1, 64]);
  }

  async process(audioChunk) {
    const input = new ort.Tensor(
      'float32',
      audioChunk,
      [1, audioChunk.length]
    );

    const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(this.sampleRate)]), []);

    const result = await this.session.run({
      input: input,
      sr: sr,
      h: this.h,
      c: this.c,
    });

    // Update LSTM state
    this.h = result.hn;
    this.c = result.cn;

    const speechProbability = result.output.data[0];
    return speechProbability > this.threshold;
  }

  reset() {
    this.h = new ort.Tensor('float32', new Float32Array(2 * 64), [2, 1, 64]);
    this.c = new ort.Tensor('float32', new Float32Array(2 * 64), [2, 1, 64]);
  }
}

module.exports = { SileroVAD };
```

### Integration with Audio Pipeline

```javascript
// src/services/audio-pipeline.js
class LocalAudioPipeline {
  constructor() {
    this.vad = new SileroVAD();
    this.stt = new LocalSTT({ model: 'base' });
    this.buffer = [];
    this.isSpeaking = false;
    this.silenceFrames = 0;
    this.minSpeechFrames = 3;  // ~100ms
    this.maxSilenceFrames = 15;  // ~500ms
  }

  async initialize() {
    await Promise.all([
      this.vad.initialize(),
      this.stt.initialize(),
    ]);
  }

  async processChunk(audioChunk) {
    const hasSpeech = await this.vad.process(audioChunk);

    if (hasSpeech) {
      this.silenceFrames = 0;
      this.buffer.push(audioChunk);

      if (!this.isSpeaking && this.buffer.length >= this.minSpeechFrames) {
        this.isSpeaking = true;
        this.emit('speechStart');
      }
    } else {
      this.silenceFrames++;

      if (this.isSpeaking) {
        this.buffer.push(audioChunk);  // Keep some trailing audio

        if (this.silenceFrames >= this.maxSilenceFrames) {
          // Speech ended - transcribe
          const fullAudio = this.mergeBuffers(this.buffer);
          this.isSpeaking = false;
          this.emit('speechEnd');

          const result = await this.stt.transcribe(fullAudio);
          this.emit('transcript', result);

          this.buffer = [];
          this.vad.reset();
        }
      }
    }
  }

  mergeBuffers(buffers) {
    const length = buffers.reduce((sum, b) => sum + b.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }
}
```

---

## Local Intent Classification

### Tier 1: Dictionary Lookup (Instant)

```javascript
// Direct match in personal dictionary
class DictionaryLookup {
  constructor(dictionary) {
    this.dictionary = dictionary;
    this.index = this.buildIndex(dictionary);
  }

  buildIndex(dictionary) {
    const index = new Map();
    for (const entry of dictionary.commands) {
      for (const phrase of entry.phrases) {
        index.set(phrase.toLowerCase(), entry.action);
      }
    }
    return index;
  }

  lookup(text) {
    const normalized = text.toLowerCase().trim();
    const action = this.index.get(normalized);

    if (action) {
      return { action, confidence: 1.0, tier: 1 };
    }
    return null;
  }
}
```

### Tier 2: Fuzzy Matching (<5ms)

```javascript
const Fuse = require('fuse.js');

class FuzzyMatcher {
  constructor(dictionary) {
    this.fuse = new Fuse(dictionary.commands, {
      keys: ['phrases'],
      threshold: 0.3,
      includeScore: true,
    });
  }

  match(text) {
    const results = this.fuse.search(text);

    if (results.length > 0 && results[0].score < 0.3) {
      return {
        action: results[0].item.action,
        confidence: 1 - results[0].score,
        tier: 2,
        matched_phrase: results[0].item.phrases[0],
      };
    }
    return null;
  }
}
```

### Tier 3: Local LLM (~100ms)

Using a small, fine-tuned model for intent classification.

```javascript
// src/services/local-intent.js
const ort = require('onnxruntime-node');

class LocalIntentClassifier {
  constructor() {
    this.session = null;
    this.tokenizer = null;
    this.labels = null;
  }

  async initialize() {
    // Load fine-tuned model (based on Phi-3-mini or similar)
    this.session = await ort.InferenceSession.create(
      path.join(__dirname, '../models/intent_classifier.onnx')
    );

    // Load tokenizer
    this.tokenizer = await AutoTokenizer.from_pretrained(
      path.join(__dirname, '../models/intent_tokenizer')
    );

    // Load intent labels
    this.labels = require('../models/intent_labels.json');
  }

  async classify(text) {
    const startTime = Date.now();

    // Tokenize input
    const inputs = await this.tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: 64,
      return_tensors: 'np',
    });

    // Run inference
    const inputIds = new ort.Tensor('int64', inputs.input_ids, [1, inputs.input_ids.length]);
    const attentionMask = new ort.Tensor('int64', inputs.attention_mask, [1, inputs.attention_mask.length]);

    const output = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    });

    // Get probabilities
    const logits = output.logits.data;
    const probs = this.softmax(logits);

    // Get top prediction
    const topIndex = probs.indexOf(Math.max(...probs));
    const topLabel = this.labels[topIndex];
    const confidence = probs[topIndex];

    const latency = Date.now() - startTime;

    return {
      action: topLabel,
      confidence,
      tier: 3,
      latency,
    };
  }

  softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exp = logits.map(l => Math.exp(l - maxLogit));
    const sum = exp.reduce((a, b) => a + b);
    return exp.map(e => e / sum);
  }
}
```

### Training Data for Local Model

```jsonl
{"text": "open terminal", "intent": "app_focus", "action": "focus_app:Terminal"}
{"text": "focus the terminal", "intent": "app_focus", "action": "focus_app:Terminal"}
{"text": "switch to terminal", "intent": "app_focus", "action": "focus_app:Terminal"}
{"text": "bring up terminal", "intent": "app_focus", "action": "focus_app:Terminal"}
{"text": "yes", "intent": "confirm", "action": "confirm"}
{"text": "yeah", "intent": "confirm", "action": "confirm"}
{"text": "affirmative", "intent": "confirm", "action": "confirm"}
{"text": "do it", "intent": "confirm", "action": "confirm"}
{"text": "play music", "intent": "media_control", "action": "media_play"}
{"text": "start playing", "intent": "media_control", "action": "media_play"}
{"text": "resume", "intent": "media_control", "action": "media_play"}
```

---

## Model Management

### Model Download & Updates

```javascript
// src/services/model-manager.js
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

class ModelManager {
  constructor() {
    this.modelDir = path.join(os.homedir(), '.config', 'one', 'models');
    this.registry = {
      'whisper-tiny': {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        size: 75000000,
        sha256: 'bd577a113a864445d4c299f3fe779d6aa3f87b3d9b7b0e769c9f5e50f81c17a9',
      },
      'whisper-base': {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        size: 145000000,
        sha256: '60ed5bc3dd14eea856493d2d0b7c9c4dcb1e5edbe87c6c2bba31eb8e6f63e2b7',
      },
      // ... more models
    };
  }

  async ensureModel(modelName) {
    const modelPath = path.join(this.modelDir, `${modelName}.bin`);

    if (await this.isModelValid(modelName, modelPath)) {
      return modelPath;
    }

    console.log(`Downloading ${modelName}...`);
    await this.downloadModel(modelName, modelPath);
    return modelPath;
  }

  async isModelValid(modelName, modelPath) {
    if (!fs.existsSync(modelPath)) {
      return false;
    }

    const registry = this.registry[modelName];
    if (!registry) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Verify checksum
    const hash = await this.hashFile(modelPath);
    return hash === registry.sha256;
  }

  async downloadModel(modelName, destPath) {
    const registry = this.registry[modelName];

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloaded = 0;

      https.get(registry.url, (response) => {
        response.pipe(file);

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = Math.round((downloaded / registry.size) * 100);
          process.stdout.write(`\rDownloading: ${percent}%`);
        });

        file.on('finish', () => {
          file.close();
          console.log('\nDownload complete.');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }

  async hashFile(filePath) {
    return new Promise((resolve) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  listDownloadedModels() {
    if (!fs.existsSync(this.modelDir)) {
      return [];
    }

    return fs.readdirSync(this.modelDir)
      .filter(f => f.endsWith('.bin'))
      .map(f => f.replace('.bin', ''));
  }

  async deleteModel(modelName) {
    const modelPath = path.join(this.modelDir, `${modelName}.bin`);
    if (fs.existsSync(modelPath)) {
      await fs.promises.unlink(modelPath);
    }
  }

  getStorageUsed() {
    const models = this.listDownloadedModels();
    let total = 0;
    for (const model of models) {
      const stats = fs.statSync(path.join(this.modelDir, `${model}.bin`));
      total += stats.size;
    }
    return total;
  }
}

module.exports = { ModelManager };
```

---

## Hybrid Mode Logic

```javascript
// src/services/hybrid-processor.js
class HybridProcessor {
  constructor(config) {
    this.config = config;
    this.localPipeline = new LocalAudioPipeline();
    this.cloudSTT = new DeepgramSTT();  // existing
    this.localIntent = new LocalIntentClassifier();
    this.cloudIntent = new IntentResolver();  // existing

    this.stats = {
      local: { calls: 0, successes: 0 },
      cloud: { calls: 0, successes: 0 },
    };
  }

  async process(audio) {
    const mode = this.config.mode;  // 'local' | 'cloud' | 'hybrid'

    if (mode === 'cloud') {
      return this.processCloud(audio);
    }

    if (mode === 'local') {
      return this.processLocal(audio);
    }

    // Hybrid: local first, escalate if needed
    return this.processHybrid(audio);
  }

  async processLocal(audio) {
    this.stats.local.calls++;

    // STT
    const transcript = await this.localPipeline.stt.transcribe(audio);

    // Intent classification through tiers
    let result = this.localIntent.dictionaryLookup(transcript.text);
    if (!result) {
      result = this.localIntent.fuzzyMatch(transcript.text);
    }
    if (!result) {
      result = await this.localIntent.classify(transcript.text);
    }

    if (result && result.confidence >= this.config.local_confidence_threshold) {
      this.stats.local.successes++;
      return { ...result, source: 'local', transcript: transcript.text };
    }

    // Below threshold
    return {
      action: null,
      confidence: result?.confidence || 0,
      source: 'local',
      transcript: transcript.text,
      needs_escalation: true,
    };
  }

  async processCloud(audio) {
    this.stats.cloud.calls++;

    const transcript = await this.cloudSTT.transcribe(audio);
    const intent = await this.cloudIntent.resolve(transcript.text);

    if (intent.action) {
      this.stats.cloud.successes++;
    }

    return { ...intent, source: 'cloud', transcript: transcript.text };
  }

  async processHybrid(audio) {
    const localResult = await this.processLocal(audio);

    if (!localResult.needs_escalation) {
      return localResult;
    }

    // Escalation decision
    const policy = this.config.escalation_policy;

    if (policy === 'never') {
      // Return low-confidence local result
      return localResult;
    }

    if (policy === 'always') {
      return this.processCloud(audio);
    }

    if (policy === 'ask') {
      // Emit event asking user
      this.emit('escalation_request', {
        transcript: localResult.transcript,
        local_confidence: localResult.confidence,
      });

      // Wait for user response (with timeout)
      const userChoice = await this.waitForUserChoice(5000);

      if (userChoice === 'cloud') {
        return this.processCloud(audio);
      }

      return localResult;
    }
  }

  getStats() {
    return {
      local: {
        ...this.stats.local,
        success_rate: this.stats.local.calls > 0
          ? this.stats.local.successes / this.stats.local.calls
          : 0,
      },
      cloud: {
        ...this.stats.cloud,
        success_rate: this.stats.cloud.calls > 0
          ? this.stats.cloud.successes / this.stats.cloud.calls
          : 0,
      },
    };
  }
}
```

---

## Hardware Detection & Recommendations

```javascript
// src/services/hardware-profiler.js
const os = require('os');
const { execSync } = require('child_process');

class HardwareProfiler {
  profile() {
    const platform = os.platform();
    const cpus = os.cpus();
    const memory = os.totalmem();

    let gpu = null;
    let recommendation = 'cloud';

    if (platform === 'darwin') {
      // macOS - check for Apple Silicon
      const arch = os.arch();
      const isAppleSilicon = arch === 'arm64';

      if (isAppleSilicon) {
        gpu = this.getAppleSiliconGPU();
        recommendation = this.recommendForAppleSilicon(gpu, memory);
      } else {
        // Intel Mac
        recommendation = this.recommendForIntelMac(cpus, memory);
      }
    } else if (platform === 'linux') {
      gpu = this.getLinuxGPU();
      recommendation = this.recommendForLinux(cpus, memory, gpu);
    } else if (platform === 'win32') {
      gpu = this.getWindowsGPU();
      recommendation = this.recommendForWindows(cpus, memory, gpu);
    }

    return {
      platform,
      arch: os.arch(),
      cpus: cpus.length,
      cpu_model: cpus[0]?.model,
      memory_gb: Math.round(memory / 1024 / 1024 / 1024),
      gpu,
      recommendation,
    };
  }

  getAppleSiliconGPU() {
    try {
      const result = execSync('system_profiler SPDisplaysDataType -json').toString();
      const data = JSON.parse(result);
      return data.SPDisplaysDataType?.[0]?.sppci_model || 'Apple Silicon GPU';
    } catch {
      return 'Apple Silicon GPU';
    }
  }

  recommendForAppleSilicon(gpu, memory) {
    const memoryGB = memory / 1024 / 1024 / 1024;

    if (memoryGB >= 16) {
      return {
        mode: 'local',
        stt_model: 'whisper-base',
        intent_model: 'phi-3-mini',
        expected_latency: '~150ms',
        reason: 'Apple Silicon with 16GB+ RAM handles local processing excellently',
      };
    }

    if (memoryGB >= 8) {
      return {
        mode: 'hybrid',
        stt_model: 'whisper-tiny',
        intent_model: 'dictionary+fuzzy',
        expected_latency: '~80ms local, escalate complex',
        reason: '8GB RAM is sufficient for lightweight local processing',
      };
    }

    return {
      mode: 'cloud',
      reason: 'Limited RAM - cloud processing recommended',
    };
  }

  recommendForIntelMac(cpus, memory) {
    const cores = cpus.length;
    const memoryGB = memory / 1024 / 1024 / 1024;
    const cpuYear = this.estimateCPUYear(cpus[0]?.model);

    if (cpuYear >= 2019 && cores >= 8 && memoryGB >= 16) {
      return {
        mode: 'hybrid',
        stt_model: 'whisper-tiny',
        intent_model: 'dictionary+fuzzy',
        expected_latency: '~200ms local',
        reason: 'Modern Intel Mac - lightweight local processing viable',
      };
    }

    return {
      mode: 'cloud',
      reason: 'Older Intel Mac - cloud processing recommended for best experience',
    };
  }

  estimateCPUYear(model) {
    if (!model) return 2015;
    // Rough estimation based on model string
    const match = model.match(/i[357]-(\d{4,5})/);
    if (match) {
      const gen = parseInt(match[1].charAt(0));
      return 2010 + gen;
    }
    return 2015;
  }

  // Similar methods for Linux and Windows...
}

module.exports = { HardwareProfiler };
```

---

## GUI Integration

### Model Management UI

```html
<!-- gui/local-models.html -->
<div class="model-manager">
  <h2>Local Processing</h2>

  <div class="mode-selector">
    <label>Processing Mode:</label>
    <select id="processing-mode">
      <option value="cloud">Cloud Only (Recommended for older hardware)</option>
      <option value="hybrid">Hybrid (Local first, cloud fallback)</option>
      <option value="local">Local Only (Offline capable)</option>
    </select>
  </div>

  <div class="hardware-info">
    <h3>Your Hardware</h3>
    <p id="hardware-summary">Detecting...</p>
    <p id="recommendation">Loading recommendation...</p>
  </div>

  <div class="models-list">
    <h3>Downloaded Models</h3>
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Size</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="models-table">
        <!-- Populated dynamically -->
      </tbody>
    </table>

    <div class="storage-info">
      <span id="storage-used">0 MB</span> used
    </div>
  </div>

  <div class="download-section">
    <h3>Available Models</h3>
    <button class="download-btn" data-model="whisper-tiny">
      Download Whisper Tiny (75MB)
    </button>
    <button class="download-btn" data-model="whisper-base">
      Download Whisper Base (145MB)
    </button>
    <button class="download-btn" data-model="whisper-small">
      Download Whisper Small (488MB)
    </button>
  </div>
</div>
```

---

## Performance Benchmarks

### Target Metrics

| Scenario | Cloud (Current) | Local (Target) |
|----------|-----------------|----------------|
| Wake word detection | N/A | <30ms |
| Short command STT | 300ms | <100ms |
| Long sentence STT | 500ms | <300ms |
| Intent classification | 200ms | <50ms |
| End-to-end (short) | 500ms | <150ms |
| End-to-end (long) | 700ms | <400ms |

### Benchmark Script

```javascript
// scripts/benchmark-local.js
async function runBenchmarks() {
  const localSTT = new LocalSTT({ model: 'base' });
  const localIntent = new LocalIntentClassifier();

  await localSTT.initialize();
  await localIntent.initialize();

  const testCases = [
    { audio: 'test/audio/open-terminal.wav', expected: 'focus_app:Terminal' },
    { audio: 'test/audio/play-music.wav', expected: 'media_play' },
    { audio: 'test/audio/yes.wav', expected: 'confirm' },
  ];

  console.log('Running STT benchmarks...\n');

  for (const test of testCases) {
    const audio = await loadAudio(test.audio);

    // Warm-up
    await localSTT.transcribe(audio);

    // Benchmark
    const runs = 10;
    const times = [];

    for (let i = 0; i < runs; i++) {
      const start = process.hrtime.bigint();
      const result = await localSTT.transcribe(audio);
      const end = process.hrtime.bigint();

      times.push(Number(end - start) / 1_000_000);  // ms
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`${path.basename(test.audio)}`);
    console.log(`  Avg: ${avg.toFixed(1)}ms, Min: ${min.toFixed(1)}ms, Max: ${max.toFixed(1)}ms`);
  }
}
```

---

## Migration Path

### From Cloud-Only to Hybrid

1. **Phase 1: Add local STT option** (parallel path)
   - Both cloud and local work simultaneously
   - Compare results silently
   - Gather accuracy metrics

2. **Phase 2: Default to hybrid** (local first)
   - Local for high-confidence commands
   - Cloud escalation for complex queries
   - User can override

3. **Phase 3: Full local option**
   - Complete offline capability
   - Local training mode
   - Sync learned commands when online

---

## Open Questions

1. **Model Updates:** How do we update fine-tuned intent models without breaking user's learned commands?

2. **Privacy Logging:** Should we log transcripts locally for debugging? User consent model?

3. **Model Size vs Accuracy:** User preference slider? Or auto-detect based on hardware?

4. **Wake Word:** Should wake word detection use a separate ultra-lightweight model (like Porcupine)?

---

*Last updated: 2025-12-08 by dreamer*
