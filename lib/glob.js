'use strict'

function glob(pattern, str) {
  let patterns = pattern.split(/\s+/)

  for (var i = 0, len = patterns.length; i < len; i++) {
    let negate = false

    pattern = patterns[i]
    if (pattern.charAt(0) === '!') {
      negate = true
      pattern = pattern.slice(1)
    }
    pattern = pattern.replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.?')
      .replace(/,/g, '|')

    if (negate ^ new RegExp('^(?:' + pattern + ')$').test(str)) {
      return true
    }
  }

  return false
}


module.exports = glob
