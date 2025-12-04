#!/usr/bin/env node
// Test Ableton OSC commands directly
// Usage: node test-ableton.js <command> [args]
// Examples:
//   node test-ableton.js play
//   node test-ableton.js stop
//   node test-ableton.js tempo 120
//   node test-ableton.js mute 1
//   node test-ableton.js scene 2

import { Client } from 'node-osc';

const client = new Client('127.0.0.1', 11000);

const [,, command, ...args] = process.argv;

const commands = {
  // Transport
  play: () => client.send('/live/song/start_playing'),
  stop: () => client.send('/live/song/stop_playing'),
  continue: () => client.send('/live/song/continue_playing'),
  record: () => client.send('/live/song/trigger_session_record'),
  undo: () => client.send('/live/song/undo'),
  redo: () => client.send('/live/song/redo'),
  tap: () => client.send('/live/song/tap_tempo'),

  // Tempo & metronome
  tempo: (bpm) => client.send('/live/song/set/tempo', parseFloat(bpm)),
  metronome: (on) => client.send('/live/song/set/metronome', on === 'off' ? 0 : 1),
  loop: (on) => client.send('/live/song/set/loop', on === 'off' ? 0 : 1),

  // Tracks (1-indexed input, converted to 0-indexed)
  mute: (track) => client.send('/live/track/set/mute', parseInt(track) - 1, 1),
  unmute: (track) => client.send('/live/track/set/mute', parseInt(track) - 1, 0),
  solo: (track) => client.send('/live/track/set/solo', parseInt(track) - 1, 1),
  unsolo: (track) => client.send('/live/track/set/solo', parseInt(track) - 1, 0),
  arm: (track) => client.send('/live/track/set/arm', parseInt(track) - 1, 1),
  disarm: (track) => client.send('/live/track/set/arm', parseInt(track) - 1, 0),
  volume: (track, vol) => client.send('/live/track/set/volume', parseInt(track) - 1, parseFloat(vol) / 100),
  select: (track) => client.send('/live/view/set/selected_track', parseInt(track) - 1),

  // Scenes (1-indexed input)
  scene: (num) => client.send('/live/scene/fire', parseInt(num) - 1),
  stopall: () => client.send('/live/song/stop_all_clips'),

  // Create tracks
  newaudio: () => client.send('/live/song/create_audio_track', -1),
  newmidi: () => client.send('/live/song/create_midi_track', -1),
  newreturn: () => client.send('/live/song/create_return_track'),
  deletetrack: (track) => client.send('/live/song/delete_track', parseInt(track) - 1),
  duptrack: (track) => client.send('/live/song/duplicate_track', parseInt(track) - 1),

  // Scenes
  newscene: () => client.send('/live/song/create_scene', -1),
  deletescene: (scene) => client.send('/live/song/delete_scene', parseInt(scene) - 1),
  dupscene: (scene) => client.send('/live/song/duplicate_scene', parseInt(scene) - 1),

  // Capture
  capture: () => client.send('/live/song/capture_midi'),

  // Navigation
  nextcue: () => client.send('/live/song/jump_to_next_cue'),
  prevcue: () => client.send('/live/song/jump_to_prev_cue'),

  // Get info
  gettempo: () => client.send('/live/song/get/tempo'),
};

if (!command || !commands[command]) {
  console.log('Available commands:');
  console.log('  Transport:  play, stop, continue, record, undo, redo, tap');
  console.log('  Settings:   tempo <bpm>, metronome [on/off], loop [on/off]');
  console.log('  Tracks:     mute <n>, unmute <n>, solo <n>, unsolo <n>');
  console.log('              arm <n>, disarm <n>, volume <n> <0-100>, select <n>');
  console.log('  Create:     newaudio, newmidi, newreturn, newscene');
  console.log('  Delete:     deletetrack <n>, deletescene <n>');
  console.log('  Duplicate:  duptrack <n>, dupscene <n>');
  console.log('  Scenes:     scene <n>, stopall');
  console.log('  Navigate:   nextcue, prevcue');
  console.log('  Other:      capture, gettempo');
  process.exit(1);
}

console.log(`Sending: ${command} ${args.join(' ')}`);
commands[command](...args);

setTimeout(() => {
  client.close();
  console.log('Done');
}, 100);
