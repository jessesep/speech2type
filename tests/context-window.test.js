/**
 * Tests for Context Window Service (context-window.js)
 *
 * Tests the sliding window of recent activity for context-aware learning.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContextWindow } from '../src/services/context-window.js';

describe('ContextWindow', () => {
  let ctx;

  beforeEach(() => {
    ctx = new ContextWindow(10);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates empty history', () => {
      expect(ctx.history).toEqual([]);
    });

    it('sets default window size', () => {
      expect(ctx.windowSize).toBe(10);
    });

    it('accepts custom window size', () => {
      const customCtx = new ContextWindow(5);
      expect(customCtx.windowSize).toBe(5);
    });
  });

  describe('add()', () => {
    it('adds entry with timestamp', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.add({ type: 'speech', text: 'hello' });

      expect(ctx.history.length).toBe(1);
      expect(ctx.history[0].type).toBe('speech');
      expect(ctx.history[0].text).toBe('hello');
      expect(ctx.history[0].timestamp).toBe(Date.now());
    });

    it('maintains window size limit', () => {
      const smallCtx = new ContextWindow(3);
      smallCtx.add({ type: 'speech', text: '1' });
      smallCtx.add({ type: 'speech', text: '2' });
      smallCtx.add({ type: 'speech', text: '3' });
      smallCtx.add({ type: 'speech', text: '4' });

      expect(smallCtx.history.length).toBe(3);
      expect(smallCtx.history[0].text).toBe('2'); // First entry removed
      expect(smallCtx.history[2].text).toBe('4');
    });
  });

  describe('addSpeech()', () => {
    it('adds speech entry with text', () => {
      ctx.addSpeech('send it');

      expect(ctx.history[0].type).toBe('speech');
      expect(ctx.history[0].text).toBe('send it');
    });
  });

  describe('addAction()', () => {
    it('adds action entry with confidence', () => {
      ctx.addAction('enter', 0.95, 1);

      expect(ctx.history[0].type).toBe('action');
      expect(ctx.history[0].action).toBe('enter');
      expect(ctx.history[0].confidence).toBe(0.95);
      expect(ctx.history[0].tier).toBe(1);
    });

    it('handles missing tier', () => {
      ctx.addAction('enter', 0.9);

      expect(ctx.history[0].tier).toBeNull();
    });
  });

  describe('addFeedback()', () => {
    it('adds positive feedback', () => {
      ctx.addFeedback('positive', 'enter');

      expect(ctx.history[0].type).toBe('feedback');
      expect(ctx.history[0].feedbackType).toBe('positive');
      expect(ctx.history[0].action).toBe('enter');
    });

    it('adds negative feedback without action', () => {
      ctx.addFeedback('negative');

      expect(ctx.history[0].type).toBe('feedback');
      expect(ctx.history[0].feedbackType).toBe('negative');
      expect(ctx.history[0].action).toBeNull();
    });
  });

  describe('addConfirmation()', () => {
    it('adds positive confirmation', () => {
      ctx.addConfirmation('enter', true);

      expect(ctx.history[0].type).toBe('confirmation');
      expect(ctx.history[0].action).toBe('enter');
      expect(ctx.history[0].feedbackType).toBe('positive');
    });

    it('adds negative confirmation (rejection)', () => {
      ctx.addConfirmation('undo', false);

      expect(ctx.history[0].feedbackType).toBe('negative');
    });
  });

  describe('addCorrection()', () => {
    it('adds correction entry with all fields', () => {
      ctx.addCorrection('send it', 'undo', 'enter');

      expect(ctx.history[0].type).toBe('correction');
      expect(ctx.history[0].originalPhrase).toBe('send it');
      expect(ctx.history[0].action).toBe('undo');
      expect(ctx.history[0].intendedAction).toBe('enter');
    });
  });

  describe('getRecent()', () => {
    it('returns entries within time window', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addSpeech('old speech');

      vi.setSystemTime(new Date('2025-01-01T12:00:10Z')); // 10 seconds later
      ctx.addSpeech('new speech');

      const recent = ctx.getRecent(5);
      expect(recent.length).toBe(1);
      expect(recent[0].text).toBe('new speech');
    });

    it('returns all entries within window', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addSpeech('speech 1');
      ctx.addSpeech('speech 2');
      ctx.addSpeech('speech 3');

      const recent = ctx.getRecent(5);
      expect(recent.length).toBe(3);
    });

    it('returns empty array when no recent entries', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addSpeech('old');

      vi.setSystemTime(new Date('2025-01-01T12:01:00Z')); // 1 minute later
      const recent = ctx.getRecent(5);
      expect(recent.length).toBe(0);
    });
  });

  describe('getLastAction()', () => {
    it('returns most recent action', () => {
      ctx.addSpeech('hello');
      ctx.addAction('enter', 0.95, 1);
      ctx.addSpeech('goodbye');
      ctx.addAction('undo', 0.9, 2);

      const last = ctx.getLastAction();
      expect(last.action).toBe('undo');
    });

    it('returns null when no actions', () => {
      ctx.addSpeech('hello');
      ctx.addFeedback('positive');

      expect(ctx.getLastAction()).toBeNull();
    });
  });

  describe('getLastSpeech()', () => {
    it('returns most recent speech', () => {
      ctx.addSpeech('first');
      ctx.addAction('enter', 0.95);
      ctx.addSpeech('second');

      const last = ctx.getLastSpeech();
      expect(last.text).toBe('second');
    });

    it('returns null when no speech', () => {
      ctx.addAction('enter', 0.95);

      expect(ctx.getLastSpeech()).toBeNull();
    });
  });

  describe('hasRecentAction()', () => {
    it('returns true when action within time window', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addAction('enter', 0.95);

      vi.setSystemTime(new Date('2025-01-01T12:00:03Z')); // 3 seconds later
      expect(ctx.hasRecentAction(5)).toBe(true);
    });

    it('returns false when action outside time window', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addAction('enter', 0.95);

      vi.setSystemTime(new Date('2025-01-01T12:00:10Z')); // 10 seconds later
      expect(ctx.hasRecentAction(5)).toBe(false);
    });

    it('returns false when no actions', () => {
      expect(ctx.hasRecentAction(5)).toBe(false);
    });
  });

  describe('hasRecentNegativeFeedback()', () => {
    it('detects negative feedback', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addFeedback('negative');

      expect(ctx.hasRecentNegativeFeedback(3)).toBe(true);
    });

    it('detects negative confirmation', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addConfirmation('enter', false);

      expect(ctx.hasRecentNegativeFeedback(3)).toBe(true);
    });

    it('ignores positive feedback', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addFeedback('positive');

      expect(ctx.hasRecentNegativeFeedback(3)).toBe(false);
    });

    it('respects time window', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      ctx.addFeedback('negative');

      vi.setSystemTime(new Date('2025-01-01T12:00:05Z')); // 5 seconds later
      expect(ctx.hasRecentNegativeFeedback(3)).toBe(false);
    });
  });

  describe('getSpeechBeforeLastAction()', () => {
    it('returns speech that triggered action', () => {
      ctx.addSpeech('send it');
      ctx.addAction('enter', 0.95);
      ctx.addSpeech('goodbye');

      expect(ctx.getSpeechBeforeLastAction()).toBe('send it');
    });

    it('handles multiple actions correctly', () => {
      ctx.addSpeech('first');
      ctx.addAction('enter', 0.95);
      ctx.addSpeech('undo that');
      ctx.addAction('undo', 0.9);

      expect(ctx.getSpeechBeforeLastAction()).toBe('undo that');
    });

    it('returns null when no speech before action', () => {
      ctx.addAction('enter', 0.95);
      ctx.addSpeech('hello');

      expect(ctx.getSpeechBeforeLastAction()).toBeNull();
    });

    it('returns null when no actions', () => {
      ctx.addSpeech('hello');

      expect(ctx.getSpeechBeforeLastAction()).toBeNull();
    });
  });

  describe('clear()', () => {
    it('removes all history', () => {
      ctx.addSpeech('one');
      ctx.addSpeech('two');
      ctx.addAction('enter', 0.9);

      ctx.clear();

      expect(ctx.history.length).toBe(0);
    });
  });

  describe('getAll()', () => {
    it('returns copy of all history', () => {
      ctx.addSpeech('one');
      ctx.addSpeech('two');

      const all = ctx.getAll();

      expect(all.length).toBe(2);
      // Verify it's a copy
      all.push({ type: 'speech', text: 'three' });
      expect(ctx.history.length).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('calculates correct statistics', () => {
      ctx.addAction('enter', 0.95);
      ctx.addAction('undo', 0.9);
      ctx.addCorrection('send it', 'undo', 'enter');
      ctx.addFeedback('negative');

      const stats = ctx.getStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.actions).toBe(2);
      expect(stats.corrections).toBe(1);
      // Only feedback with feedbackType='negative' counts, not corrections
      expect(stats.negativeFeedback).toBe(1);
      expect(stats.errorRate).toBe('0.50'); // 1 correction / 2 actions
    });

    it('handles empty history', () => {
      const stats = ctx.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.actions).toBe(0);
      expect(stats.errorRate).toBe('0.00');
    });

    it('handles zero actions correctly', () => {
      ctx.addSpeech('hello');
      ctx.addFeedback('positive');

      const stats = ctx.getStats();

      expect(stats.actions).toBe(0);
      expect(stats.errorRate).toBe('0.00');
    });
  });
});
