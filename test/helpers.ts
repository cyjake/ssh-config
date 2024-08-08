const stripPattern = /^[ \t]*(?=[^\s]+)/mg

export function heredoc(text: string) {
  const indentLen = text.match(stripPattern)!.reduce((min, line) => Math.min(min, line.length), Infinity)
  const indent = new RegExp('^[ \\t]{' + indentLen + '}', 'mg')
  return indentLen > 0
    ? text.replace(indent, '').trimStart().replace(/ +?$/, '')
    : text
}
