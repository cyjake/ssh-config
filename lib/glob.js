'use strict'

function match(pattern, str) {
  pattern = pattern.replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?')

  return new RegExp('^(?:' + pattern + ')$').test(str)
}

/**
 * A helper function to match input against [pattern-list](https://www.freebsd.org/cgi/man.cgi?query=ssh_config&sektion=5#PATTERNS).
 * According to `man ssh_config`, negated patterns shall be matched first.
 *
 * @param {string} patternList
 * @param {string} str
 */
function glob(patternList, str) {
  const patterns = patternList.split(/[,\s]+/).sort((a, b) => {
    return a.startsWith('!') ? -1 : 1
  })

  for (const pattern of patterns) {
    const negate = pattern[0] == '!'

    if (negate && match(pattern.slice(1), str)) {
      return false
    } else if (match(pattern, str)) {
      return true
    }
  }

  return false
}


module.exports = glob
