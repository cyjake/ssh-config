
import glob from './glob'
import { spawnSync } from 'child_process'

const RE_SPACE = /\s/
const RE_LINE_BREAK = /\r|\n/
const RE_SECTION_DIRECTIVE = /^(Host|Match)$/i
const RE_MULTI_VALUE_DIRECTIVE = /^(GlobalKnownHostsFile|Host|IPQoS|SendEnv|UserKnownHostsFile|ProxyCommand|Match)$/i
const RE_QUOTE_DIRECTIVE = /^(?:CertificateFile|IdentityFile|IdentityAgent|User)$/i
const RE_SINGLE_LINE_DIRECTIVE = /^(Include|IdentityFile)$/i

enum LineType {
  DIRECTIVE = 1,
  COMMENT = 2,
}

type Separator = ' ' | '=' | '\t';

type Space = ' ' | '\t' | '\n';

interface Directive {
  type: LineType.DIRECTIVE;
  before: string;
  after: string;
  param: string;
  separator: Separator;
  value: string | string[];
  quoted?: boolean;
}

interface Section extends Directive {
  config: SSHConfig;
}

interface Match extends Section {
  criteria: Record<string, string | string[]>
}

interface Comment {
  type: LineType.COMMENT;
  before: string;
  after: string;
  content: string;
}

type Line = Match | Section | Directive | Comment;

interface FindOptions {
  Host?: string;
}

const MULTIPLE_VALUE_PROPS = [
  'IdentityFile',
  'LocalForward',
  'RemoteForward',
  'DynamicForward',
  'CertificateFile',
]

function compare(line, opts) {
  return opts.hasOwnProperty(line.param) && opts[line.param] === line.value
}

function getIndent(config: SSHConfig) {
  for (const line of config) {
    if (line.type === LineType.DIRECTIVE && 'config' in line) {
      for (const subline of line.config) {
        if (subline.before) {
          return subline.before
        }
      }
    }
  }

  return '  '
}

function capitalize(str) {
  if (typeof str !== 'string') return str
  return str[0].toUpperCase() + str.slice(1)
}

function match(criteria, params) {
  for (const key in criteria) {
    const criterion = criteria[key]
    const keyword = key.toLowerCase()
    if (keyword === 'exec') {
      const command = `function main {
        ${criterion}
      }
      main`
      const { status } = spawnSync(command, { shell: true })
      if (status != 0) return false
    } else if (!glob(criterion, params[capitalize(keyword)])) {
      return false
    }
  }
  return true
}

class SSHConfig extends Array<Line> {
  static DIRECTIVE: LineType.DIRECTIVE = LineType.DIRECTIVE
  static COMMENT: LineType.COMMENT = LineType.COMMENT

  /**
   * Query ssh config by host.
   */
  compute(params): Record<string, string | string[]> {
    if (typeof params === 'string') params = { Host: params }
    const obj = {}
    const setProperty = (name, value) => {
      if (MULTIPLE_VALUE_PROPS.includes(name)) {
        const list = obj[name] || (obj[name] = [])
        list.push(value)
      } else if (obj[name] == null) {
        obj[name] = value
      }
    }

    for (const line of this) {
      if (line.type !== LineType.DIRECTIVE) continue
      if (line.param === 'Host' && glob(line.value, params.Host)) {
        setProperty(line.param, line.value)
        for (const subline of (line as Section).config) {
          if (subline.type === LineType.DIRECTIVE) {
            setProperty(subline.param, subline.value)
          }
        }
      } else if (line.param === 'Match' && 'criteria' in line && match(line.criteria, params)) {
        for (const subline of (line as Section).config) {
          if (subline.type === LineType.DIRECTIVE) {
            setProperty(subline.param, subline.value)
          }
        }
      } else if (line.param !== 'Host' && line.param !== 'Match') {
        setProperty(line.param, line.value)
      }
    }

    return obj
  }

  /**
   * find section by Host / Match or function
   */
  find(opts: ((line: Line, index: number, config: Line[]) => unknown) | FindOptions) {
    if (typeof opts === 'function') return super.find(opts)

    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only find by Host or Match')
    }

    return super.find(line => compare(line, opts))
  }

  /**
   * Remove section by Host / Match or function
   */
  remove(opts: ((line: Line, index: number, config: Line[]) => unknown) | FindOptions) {
    let index: number

    if (typeof opts === 'function') {
      index = super.findIndex(opts)
    } else if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only remove by Host or Match')
    } else {
      index = super.findIndex(line => compare(line, opts))
    }

    if (index >= 0) return this.splice(index, 1)
  }

  toString(): string {
    return stringify(this)
  }

  /**
   * Append new section to existing ssh config.
   * @param {Object} opts
   */
  append(opts: Record<string, string | string[]>) {
    const indent = getIndent(this)
    const lastEntry = this.length > 0 ? this[this.length - 1] : null
    let config = lastEntry && (lastEntry as Section).config || this
    let configWas = this

    let lastLine = config.length > 0 ? config[config.length - 1] : lastEntry
    if (lastLine && !lastLine.after) lastLine.after = '\n'

    let sectionLineFound = config !== configWas

    for (const param in opts) {
      const value = opts[param]
      const line: Directive = {
        type: LineType.DIRECTIVE,
        param,
        separator: ' ',
        value,
        before: sectionLineFound ? indent : indent.replace(/  |\t/, ''),
        after: '\n',
      }

      if (RE_SECTION_DIRECTIVE.test(param)) {
        sectionLineFound = true
        line.before = indent.replace(/  |\t/, '')
        config = configWas
        // separate sections with an extra newline
        // https://github.com/cyjake/ssh-config/issues/23#issuecomment-564768248
        if (lastLine && lastLine.after === '\n') lastLine.after += '\n'
        config.push(line)
        config = (line as Section).config = new SSHConfig()
      } else {
        config.push(line)
      }
      lastLine = line
    }

    return configWas
  }

  /**
   * Prepend new section to existing ssh config.
   * @param {Object} opts
   */
  prepend(opts: Record<string, string | string[]>, beforeFirstSection = false) {
    const indent = getIndent(this)
    let config: SSHConfig = this
    let i = 0

    // insert above known sections
    if (beforeFirstSection) {
      while (i < this.length && !('config' in this[i])) {
        i += 1
      }

      if (i >= this.length) { // No sections in original config
        return this.append(opts)
      }
    }

    // Prepend new section above the first section
    let sectionLineFound = false
    let processedLines = 0

    for (const param in opts) {
      processedLines += 1
      const value = opts[param]
      const line: Directive = {
        type: LineType.DIRECTIVE,
        param,
        separator: ' ',
        value,
        before: '',
        after: '\n',
      }

      if (RE_SECTION_DIRECTIVE.test(param)) {
        line.before = indent.replace(/  |\t/, '')
        config.splice(i, 0, line)
        config = (line as Section).config = new SSHConfig()
        sectionLineFound = true
        continue
      }

      // separate from previous sections with an extra newline
      if (processedLines === Object.keys(opts).length) {
        line.after += '\n'
      }

      if (!sectionLineFound) {
        config.splice(i, 0, line)
        i += 1

        // Add an extra newline if a single line directive like Include
        if (RE_SINGLE_LINE_DIRECTIVE.test(param)) {
          line.after += '\n'
        }
        continue
      }

      line.before = indent
      config.push(line)
    }

    return config
  }
}

/**
 * Parse ssh config text into structured object.
 */
export function parse(text: string): SSHConfig {
  let i = 0
  let chr = next()
  let config: SSHConfig = new SSHConfig()
  let configWas = config

  function next() {
    return text[i++]
  }

  function space(): Space {
    let spaces = ''

    while (RE_SPACE.test(chr)) {
      spaces += chr
      chr = next()
    }

    return spaces as Space
  }

  function linebreak() {
    let breaks = ''

    while (RE_LINE_BREAK.test(chr)) {
      breaks += chr
      chr = next()
    }

    return breaks
  }

  function parameter() {
    let param = ''

    while (chr && /[^ \t=]/.test(chr)) {
      param += chr
      chr = next()
    }

    return param
  }

  function separator(): Separator {
    let sep = space()

    if (chr === '=') {
      sep += chr
      chr = next()
    }

    return (sep + space()) as Separator
  }

  function value() {
    let val = ''
    let quoted = false
    let escaped = false

    while (chr && !RE_LINE_BREAK.test(chr)) {
      // backslash escapes only double quotes
      if (escaped) {
        val += chr === '"' ? chr : `\\${chr}`
        escaped = false
      }
      // ProxyCommand ssh -W "%h:%p" firewall.example.org
      else if (chr === '"' && (!val || quoted)) {
        quoted = !quoted
      }
      else if (chr === '\\') {
        escaped = true
      }
      else {
        val += chr
      }
      chr = next()
    }

    if (quoted || escaped) {
      throw new Error(`Unexpected line break at ${val}`)
    }

    return val.trim()
  }

  function comment(): Comment {
    const type = LineType.COMMENT
    let content = ''

    while (chr && !RE_LINE_BREAK.test(chr)) {
      content += chr
      chr = next()
    }

    return { type, content, before: '', after: '' }
  }

  // Host *.co.uk
  // Host * !local.dev
  // Host "foo bar"
  function values() {
    const results: string[] = []
    let val = ''
    let quoted = false
    let escaped = false

    while (chr && !RE_LINE_BREAK.test(chr)) {
      if (escaped) {
        val += chr === '"' ? chr : `\\${chr}`
        escaped = false
      }
      else if (chr === '"') {
        quoted = !quoted
      }
      else if (chr === '\\') {
        escaped = true
      }
      else if (quoted) {
        val += chr
      }
      else if (/[ \t]/.test(chr)) {
        if (val) {
          results.push(val)
          val = ''
        }
        // otherwise ignore the space
      }
      else {
        val += chr
      }

      chr = next()
    }

    if (quoted || escaped) {
      throw new Error(`Unexpected line break at ${results.concat(val).join(' ')}`)
    }
    if (val) results.push(val)
    return results.length > 1 ? results : results[0]
  }

  function directive() {
    const type = LineType.DIRECTIVE
    const param = parameter()
    // Host "foo bar" baz
    const multiple = RE_MULTI_VALUE_DIRECTIVE.test(param)
    const result: Directive = {
      type,
      param,
      separator: separator(),
      quoted: !multiple && chr === '"',
      value: multiple ? values() : value(),
      before: '',
      after: '',
    }
    if (!result.quoted) delete result.quoted
    if (/^Match$/i.test(param)) {
      const criteria = {}
      for (let i = 0; i < result.value.length; i += 2) {
        const keyword = result.value[i]
        const value = result.value[ i + 1]
        criteria[keyword] = value
      }
      (result as Match).criteria = criteria
    }
    return result
  }

  function line() {
    const before = space()
    const node = chr === '#' ? comment() : directive()
    const after = linebreak()

    node.before = before
    node.after = after

    return node
  }

  while (chr) {
    let node = line()

    if (node.type === LineType.DIRECTIVE && RE_SECTION_DIRECTIVE.test(node.param)) {
      config = configWas
      config.push(node)
      config = (node as Section).config = new SSHConfig()
    }
    else if (node.type === LineType.DIRECTIVE && !node.param) {
      // blank lines at file end
      config[config.length - 1].after += node.before
    }
    else {
      config.push(node)
    }
  }

  return configWas
}

/**
 * Stringify structured object into ssh config text
 */
export function stringify(config: SSHConfig): string {
  let str = ''

  function formatValue(value: string | string[] | Record<string, any>, quoted: boolean) {
    if (Array.isArray(value)) {
      return value.map(chunk => formatValue(chunk, RE_SPACE.test(chunk))).join(' ')
    }
    return quoted ? `"${value}"` : value
  }

  function formatDirective(line) {
    const quoted = line.quoted
      || (RE_QUOTE_DIRECTIVE.test(line.param) && RE_SPACE.test(line.value))
    const value = formatValue(line.value, quoted)
    return `${line.param}${line.separator}${value}`
  }

  const format = line => {
    str += line.before

    if (line.type === LineType.COMMENT) {
      str += line.content
    }
    else if (line.type === LineType.DIRECTIVE && MULTIPLE_VALUE_PROPS.includes(line.param)) {
      [].concat(line.value).forEach(function (value, i, values) {
        str += formatDirective({ ...line, value })
        if (i < values.length - 1) str += `\n${line.before}`
      })
    }
    else if (line.type === LineType.DIRECTIVE) {
      str += formatDirective(line)
    }

    str += line.after

    if (line.config) {
      line.config.forEach(format)
    }
  }

  config.forEach(format)

  return str
}

export default Object.assign(SSHConfig, { parse, stringify })
