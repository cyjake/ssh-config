
function escapeChars(text: string, chars: string) {
  for (let char of chars) {
    text = text.replace(new RegExp('\\' + char, 'g'), '\\' + char)
  }

  return text
}

function match(pattern: string, text: string) {
  pattern = escapeChars(pattern, '\\()[]{}.+^$|')
  pattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?')

  return new RegExp('^(?:' + pattern + ')$').test(text)
}

/**
 * A helper function to match input against [pattern-list](https://www.freebsd.org/cgi/man.cgi?query=ssh_config&sektion=5#PATTERNS).
 * According to `man ssh_config`, negated patterns shall be matched first.
 *
 * @param {string|string[]} patternList
 * @param {string} str
 */
function glob(patternList: string | string[], text: string) {
  const patterns = Array.isArray(patternList) ? patternList : patternList.split(/,/)

  // > If a negated entry is matched, then the Host entry is ignored, regardless of whether any other patterns on the line match.
  let result = false
  for (const pattern of patterns) {
    const negate = pattern[0] == '!'

    if (negate && match(pattern.slice(1), text)) {
      return false
    } else if (match(pattern, text)) {
      // wait until all of the pattern match results because there might be a negated pattern
      result = true
    }
  }

  return result
}

export default glob
