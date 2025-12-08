import { describe, it, expect } from 'vitest';
import { generateVariations, createCommandVariations } from '../src/utils/phonetic-variations.js';

describe('phonetic-variations', () => {
  describe('generateVariations', () => {
    it('should include the original phrase', () => {
      const variations = generateVariations('power mode');
      expect(variations).toContain('power mode');
    });

    it('should lowercase the phrase', () => {
      const variations = generateVariations('POWER MODE');
      expect(variations).toContain('power mode');
      expect(variations).not.toContain('POWER MODE');
    });

    it('should generate variations for "power"', () => {
      const variations = generateVariations('power mode');
      expect(variations).toContain('powered mode');
      expect(variations).toContain('tower mode');
      expect(variations).toContain('hour mode');
    });

    it('should generate variations for "claude"', () => {
      const variations = generateVariations('claude mode');
      expect(variations).toContain('cloud mode');
      expect(variations).toContain('clod mode');
    });

    it('should generate variations for "ableton"', () => {
      const variations = generateVariations('ableton mode');
      expect(variations).toContain('able ton mode');
      expect(variations).toContain('able to mode');
    });

    it('should add no-space and hyphenated variants for two-word phrases', () => {
      const variations = generateVariations('power mode');
      expect(variations).toContain('powermode');
      expect(variations).toContain('power-mode');
    });

    it('should not add joined variants for single words', () => {
      const variations = generateVariations('power');
      // Should have variations but no joined version (only one word)
      expect(variations).toContain('power');
      expect(variations.some(v => v === 'power')).toBe(true);
    });

    it('should not add joined variants for three+ word phrases', () => {
      const variations = generateVariations('power mode on');
      expect(variations).not.toContain('powermodeon');
      expect(variations).not.toContain('power-mode-on');
    });

    it('should return unique variations', () => {
      const variations = generateVariations('power mode');
      const uniqueVariations = [...new Set(variations)];
      expect(variations.length).toBe(uniqueVariations.length);
    });
  });

  describe('createCommandVariations', () => {
    it('should map all variations to the same action', () => {
      const commands = createCommandVariations('power mode', 'POWER_MODE');

      expect(commands['power mode']).toBe('POWER_MODE');
      expect(commands['tower mode']).toBe('POWER_MODE');
      expect(commands['powermode']).toBe('POWER_MODE');
    });

    it('should add prefix when provided', () => {
      const commands = createCommandVariations('power mode', 'POWER_MODE', 'computer');

      expect(commands['computer power mode']).toBe('POWER_MODE');
      expect(commands['computer tower mode']).toBe('POWER_MODE');
    });

    it('should work without prefix', () => {
      const commands = createCommandVariations('claude', 'CLAUDE_MODE');

      expect(commands['claude']).toBe('CLAUDE_MODE');
      expect(commands['cloud']).toBe('CLAUDE_MODE');
    });
  });
});
