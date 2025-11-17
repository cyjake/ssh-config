import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const stripPattern = /^[ \t]*(?=[^\s]+)/mg

export function heredoc(text: string) {
  const indentLen = text.match(stripPattern)!.reduce((min, line) => Math.min(min, line.length), Infinity)
  const indent = new RegExp('^[ \\t]{' + indentLen + '}', 'mg')
  return indentLen > 0
    ? text.replace(indent, '').trimStart().replace(/ +?$/, '')
    : text
}

export async function readFixture(fname: string) {
  const fpath = path.join(currentDir, 'fixture', fname)
  return (await fs.readFile(fpath, 'utf-8')).replace(/\r\n/g, '\n')
}
