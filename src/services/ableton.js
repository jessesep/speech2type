import { Client } from 'node-osc';
import chalk from 'chalk';

const ABLETON_OSC_PORT = 11000;
const ABLETON_HOST = '127.0.0.1';

class AbletonService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    if (this.client) return;

    try {
      this.client = new Client(ABLETON_HOST, ABLETON_OSC_PORT);
      this.connected = true;
      console.log(chalk.green(`[ableton] Connected to OSC port ${ABLETON_OSC_PORT}`));
    } catch (error) {
      console.error(chalk.red(`[ableton] Failed to connect: ${error.message}`));
      this.connected = false;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.connected = false;
      console.log(chalk.dim('[ableton] Disconnected'));
    }
  }

  send(address, ...args) {
    if (!this.client) {
      this.connect();
    }

    if (this.client) {
      console.log(chalk.blue(`[ableton] OSC: ${address} ${args.join(' ')}`));
      this.client.send(address, ...args, (err) => {
        if (err) {
          console.error(chalk.red(`[ableton] OSC error: ${err.message}`));
        }
      });
    }
  }

  // Transport controls
  play() {
    this.send('/live/song/start_playing');
  }

  stop() {
    this.send('/live/song/stop_playing');
  }

  continue() {
    this.send('/live/song/continue_playing');
  }

  record() {
    this.send('/live/song/trigger_session_record');
  }

  overdub() {
    this.send('/live/song/set/arrangement_overdub', 1);
  }

  tapTempo() {
    this.send('/live/song/tap_tempo');
  }

  undo() {
    this.send('/live/song/undo');
  }

  redo() {
    this.send('/live/song/redo');
  }

  // Tempo & metronome
  setTempo(bpm) {
    this.send('/live/song/set/tempo', parseFloat(bpm));
  }

  metronomeOn() {
    this.send('/live/song/set/metronome', 1);
  }

  metronomeOff() {
    this.send('/live/song/set/metronome', 0);
  }

  toggleMetronome() {
    // We'd need to query first, but for simplicity just toggle via a workaround
    // For now, we'll implement on/off separately
    console.log(chalk.yellow('[ableton] Use "metronome on" or "metronome off" instead'));
  }

  // Track controls (0-indexed internally, but user says 1-indexed)
  muteTrack(trackNum) {
    this.send('/live/track/set/mute', trackNum - 1, 1);
  }

  unmuteTrack(trackNum) {
    this.send('/live/track/set/mute', trackNum - 1, 0);
  }

  soloTrack(trackNum) {
    this.send('/live/track/set/solo', trackNum - 1, 1);
  }

  unsoloTrack(trackNum) {
    this.send('/live/track/set/solo', trackNum - 1, 0);
  }

  armTrack(trackNum) {
    this.send('/live/track/set/arm', trackNum - 1, 1);
  }

  disarmTrack(trackNum) {
    this.send('/live/track/set/arm', trackNum - 1, 0);
  }

  setTrackVolume(trackNum, volume) {
    // Volume is 0.0 to 1.0, user provides 0-100
    this.send('/live/track/set/volume', trackNum - 1, volume / 100);
  }

  selectTrack(trackNum) {
    this.send('/live/view/set/selected_track', trackNum - 1);
  }

  // Scene controls (0-indexed internally)
  fireScene(sceneNum) {
    this.send('/live/scene/fire', sceneNum - 1);
  }

  stopAllClips() {
    this.send('/live/song/stop_all_clips');
  }

  // Clip controls
  fireClip(trackNum, slotNum) {
    this.send('/live/clip_slot/fire', trackNum - 1, slotNum - 1);
  }

  stopClip(trackNum) {
    this.send('/live/track/stop_all_clips', trackNum - 1);
  }

  // Loop controls
  loopOn() {
    this.send('/live/song/set/loop', 1);
  }

  loopOff() {
    this.send('/live/song/set/loop', 0);
  }

  // Navigation
  jumpBy(bars) {
    // Jump by beats (4 beats per bar)
    this.send('/live/song/jump_by', bars * 4);
  }

  jumpToNextCue() {
    this.send('/live/song/jump_to_next_cue');
  }

  jumpToPrevCue() {
    this.send('/live/song/jump_to_prev_cue');
  }

  // Quantization
  setQuantization(value) {
    // 0=None, 1=8 bars, 2=4 bars, 3=2 bars, 4=1 bar, 5=1/2, 6=1/4, etc.
    this.send('/live/song/set/clip_trigger_quantization', value);
  }
}

export { AbletonService };
