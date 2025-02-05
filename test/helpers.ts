import fs from 'fs/promises'
import path from 'path'

const stripPattern = /^[ \t]*(?=[^\s]+)/mg

export function heredoc(text: string) {
  const indentLen = text.match(stripPattern)!.reduce((min, line) => Math.min(min, line.length), Infinity)
  const indent = new RegExp('^[ \\t]{' + indentLen + '}', 'mg')
  return indentLen > 0
    ? text.replace(indent, '').trimStart().replace(/ +?$/, '')
    : text
}

export async function readFixture(fname: string) {
  const fpath = path.join(__dirname, 'fixture', fname)
  return (await fs.readFile(fpath, 'utf-8')).replace(/\r\n/g, '\n')
}
