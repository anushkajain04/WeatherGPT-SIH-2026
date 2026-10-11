/**
 * Capitalizes the first letter of each word, preserving whitespace.
 * e.g. "anushka jain" -> "Anushka Jain"
 *      "anushka " -> "Anushka "
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalizeWords(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}
