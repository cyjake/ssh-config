'use strict'

function match(pattern, str) {
  pattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\+/g, '\\+')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?')

  return new RegExp('^(?:' + pattern + ')$').test(str)
}

/**
 * A helper function to match input against [pattern-list](https://www.freebsd.org/cgi/man.cgi?query=ssh_config&sektion=5#PATTERNS).
 * According to `man ssh_config`, negated patterns shall be matched first.
 *
 * @param {string|string[]} patternList
 * @param {string} str
 */
function glob(patternList, str) {
  const patterns = Array.isArray(patternList) ? patternList : patternList.split(/,/)

  // > If a negated entry is matched, then the Host entry is ignored, regardless of whether any other patterns on the line match.
  let result = false
  for (const pattern of patterns) {
    const negate = pattern[0] == '!'

    if (negate && match(pattern.slice(1), str)) {
      return false
    } else if (match(pattern, str)) {
      // wait until all of the pattern match results because there might be a negated pattern
      result = true
    }
  }

  return result
}

module.exports = glob
