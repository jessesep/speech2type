/**
 * Generate phonetic/tonal variations for voice commands
 *
 * Speech recognition often mishears words, especially:
 * - Similar sounding words (homophones)
 * - Word boundaries (spaces inserted/removed)
 * - Common phonetic substitutions
 */

// Common phonetic substitutions that speech recognition makes
const SUBSTITUTIONS = {
  // Vowel sounds
  'a': ['ah', 'uh', 'ar'],
  'e': ['eh', 'ee', 'er'],
  'i': ['ee', 'eye', 'ih'],
  'o': ['oh', 'aw', 'or'],
  'u': ['oo', 'uh', 'you'],

  // Consonant sounds
  'b': ['p'],
  'd': ['t'],
  'g': ['k', 'c'],
  'v': ['f'],
  'z': ['s'],
  'th': ['t', 'd', 'f'],
  'sh': ['ch', 's'],
  'ch': ['sh', 'tch'],

  // Common word-level substitutions
  'power': ['powered', 'par', 'pour', 'tower', 'powder', 'hour', 'flower'],
  'claude': ['cloud', 'clod', 'claw', 'clawed'],
  'ableton': ['able ton', 'able to', 'able turn', 'abelton', 'ableten', 'able ten'],
  'music': ['musical', 'muse ik'],
  'general': ['general', 'genral'],
};

/**
 * Generate variations of a phrase for speech recognition
 * @param {string} phrase - The original phrase (e.g., "power mode")
 * @returns {string[]} - Array of variations including the original
 */
export function generateVariations(phrase) {
  const variations = new Set([phrase.toLowerCase()]);
  const words = phrase.toLowerCase().split(' ');

  // For each word, check if we have known substitutions
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check direct word substitutions
    if (SUBSTITUTIONS[word]) {
      for (const sub of SUBSTITUTIONS[word]) {
        const newWords = [...words];
        newWords[i] = sub;
        variations.add(newWords.join(' '));
      }
    }

    // Check if word can be split (e.g., "ableton" -> "able ton")
    for (const [key, subs] of Object.entries(SUBSTITUTIONS)) {
      if (word.includes(key) || word === key) {
        for (const sub of subs) {
          const newWord = word.replace(key, sub);
          if (newWord !== word) {
            const newWords = [...words];
            newWords[i] = newWord;
            variations.add(newWords.join(' '));
          }
        }
      }
    }
  }

  // Add variations without spaces between short words
  if (words.length === 2) {
    variations.add(words.join(''));
    variations.add(words.join('-'));
  }

  return Array.from(variations);
}

/**
 * Create a command map with all variations pointing to the same action
 * @param {string} phrase - The original phrase
 * @param {string} action - The action to map to
 * @param {string} prefix - Optional prefix (e.g., "computer")
 * @returns {Object} - Map of variations to action
 */
export function createCommandVariations(phrase, action, prefix = '') {
  const variations = generateVariations(phrase);
  const commands = {};

  for (const variation of variations) {
    const key = prefix ? `${prefix} ${variation}` : variation;
    commands[key] = action;
  }

  return commands;
}

export default { generateVariations, createCommandVariations };
