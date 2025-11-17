const path = require('node:path')
const fs = require('node:fs/promises')

const stripPattern = /^[ \t]*(?=[^\s]+)/mg

exports.heredoc = function heredoc(text) {
  const indentLen = text.match(stripPattern).reduce((min, line) => Math.min(min, line.length), Infinity)
  const indent = new RegExp('^[ \\t]{' + indentLen + '}', 'mg')
  return indentLen > 0
    ? text.replace(indent, '').trimStart().replace(/ +?$/, '')
    : text
}

exports.readFixture = async function readFixture(fname) {
  const fpath = path.join(__dirname, 'fixture', fname)
  return (await fs.readFile(fpath, 'utf-8')).replace(/\r\n/g, '\n')
}
