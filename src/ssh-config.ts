
import glob from './glob.ts'
import { spawnSync } from 'node:child_process'
import os from 'node:os'

const RE_SPACE = /\s/
const RE_LINE_BREAK = /\r|\n/
const RE_SECTION_DIRECTIVE = /^(Host|Match)$/i
const RE_MULTI_VALUE_DIRECTIVE = /^(GlobalKnownHostsFile|Host|IPQoS|SendEnv|UserKnownHostsFile|ProxyCommand|Match|CanonicalDomains)$/i
const RE_QUOTE_DIRECTIVE = /^(?:CertificateFile|IdentityFile|IdentityAgent|User)$/i
const RE_SINGLE_LINE_DIRECTIVE = /^(Include|IdentityFile)$/i

/**
 * A type of line in an ssh-config file. Differentiates between directives,
 * comments, and empty lines.
 */
export enum LineType {
  /** line with a directive in an ssh-config file */
  DIRECTIVE = 1,
  /** line with a comment in an ssh-config file */
  COMMENT = 2,
  /** empty line in an ssh-config file */
  EMPTY = 3
}

/** A separator character in a directive. */
export type Separator = ' ' | '=' | '\t';

type Space = ' ' | '\t' | '\n';

/**
 * A directive in an ssh-config file. This is the main type of element in the
 * file. The directive primarily consists of a
 * {@link Directive.param | parameter}, and a {@link Directive.value | value},
 * much like a key-value pair.
 *
 * We additionally keep track of a few other fields in order to print out a
 * directive exactly as it was read, even though the used syntax is equivalent.
 */
export interface Directive {
  /** type of line, always {@link LineType.DIRECTIVE} */
  type: LineType.DIRECTIVE;
  /** unrelated string encountered before this directive */
  before: string;
  /** unrelated string encountered after this directive */
  after: string;
  /** parameter name of this directive */
  param: string;
  /** separator char used in this directive */
  separator: Separator;
  /** the actual value of this directive */
  value: string | { val: string, separator: string, quoted?: boolean }[];
  /** whether or not quotes were used for the directive value */
  quoted?: boolean;
}

/** 
 * A section is a Host or Match directive in an ssh-config file. It includes a
 * reference to the contained config via {@link Section.config}.
 */
export interface Section extends Directive {
  /** the config contained in this section */
  config: SSHConfig;
}

/**
 * Represents a Match directive in an ssh-config file. It includes a reference
 * to the contained config via {@link Section.config}, and a map of all match
 * criteria via {@link Match.criteria}.
 */
export interface Match extends Section {
  /** the match criteria contained in this Match section */
  criteria: Record<string, string | {
     /** the value of this match criterion */
     val: string,
     /** separator used for this match criterion */
     separator: string,
     /** whether this match criterion was quoted */
     quoted?: boolean
  }[]>
}

/**
 * A comment in an ssh-config file. Stores the content of the comment as a
 * string in {@link Comment.content}.
 */
export interface Comment {
  /** type of line, always {@link LineType.COMMENT} */
  type: LineType.COMMENT;
  /** unrelated string encountered before this directive */
  before: string;
  /** unrelated string encountered after this directive */
  after: string;
  /** content of the comment */
  content: string;
}

/**
 * An empty or whitespace-only line in an ssh-config file. This is mainly used
 * to represent empty config ssh-config files. The actual whitespace characters
 * is usually stored in the {@link Empty.before | before} field. Storing it in
 * the {@link Empty.after | after} field is permitted, too.
 */
export interface Empty {
  /** type of line, always {@link LineType.COMMENT} */
  type: LineType.EMPTY
  /** unrelated string encountered before this directive */
  before: string,
  /** unrelated string encountered after this directive */
  after: string
}

/**
 * A single line in an ssh-config file. The union can be discrimiated via its
 * `type` property of type {@link LineType}.
 */
export type Line = Match | Section | Directive | Comment | Empty

/**
 * Options for finding a {@link Section} via Host or Match.
 */
export interface FindOptions {
  /** the host to look for */
  Host?: string;
}

/**
 * Options for querying an SSH config via host and user.
 */
export interface MatchOptions {
  /** the host of the query */
  Host: string;
  /** the user of the query */
  User?: string;
}

interface MatchParams {
  Host: string;
  HostName: string;
  OriginalHost: string;
  User: string;
  LocalUser: string;
}

interface ComputeContext {
  params: MatchParams;
  doFinalPass: boolean;
  inFinalPass: boolean;
}

const REPEATABLE_DIRECTIVES = [
  'IdentityFile',
  'LocalForward',
  'RemoteForward',
  'DynamicForward',
  'CertificateFile',
]

function compare(line: Directive, opts: FindOptions) {
  // @ts-ignore
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

function match(criteria: Match['criteria'], context: ComputeContext): boolean {
  const testCriterion = (key: string, criterion: string | string[]) => {
    switch (key.toLowerCase()) {
      case 'all':
        return true
      case 'final':
        if (context.inFinalPass) {
          return true
        }
        context.doFinalPass = true
        return false
      case 'exec':
        const command = `function main {
          ${criterion}
        }
        main`
        return spawnSync(command, { shell: true }).status === 0
      case 'host':
        return glob(criterion, context.params.HostName)
      case 'originalhost':
        return glob(criterion, context.params.OriginalHost)
      case 'user':
        return glob(criterion, context.params.User)
      case 'localuser':
        return glob(criterion, context.params.LocalUser)
    }
  }

  for (const key in criteria) {
    const criterion = criteria[key]
    const values = Array.isArray(criterion) ? criterion.map(({ val }) => val) : criterion

    if (!testCriterion(key, values)) {
      return false
    }
  }
  return true
}

/**
 * Represents parsed SSH config. Main element of this library.
 * 
 * A parsed SSH config is modelled as an array of {@link Line}s.
 */
export default class SSHConfig extends Array<Line> {
  /** shortcut to access {@link LineType.DIRECTIVE} */
  static readonly DIRECTIVE: LineType.DIRECTIVE = LineType.DIRECTIVE
  /** shortcut to access {@link LineType.COMMENT} */
  static readonly COMMENT: LineType.COMMENT = LineType.COMMENT
  /** shortcut to access {@link LineType.EMPTY} */
  static readonly EMPTY: LineType.EMPTY = LineType.EMPTY

  /**
   * Parse SSH config text into structured object.
   */
  public static parse(text: string | Buffer): SSHConfig {
    return parse(text)
  }

  /**
   * Stringify structured object into SSH config text.
   */
  public static stringify(config: SSHConfig): string {
    return stringify(config)
  }

  /**
   * Query SSH config by host.
   */
  public compute(host: string): Record<string, string | string[]>;

  /**
   * Query SSH config by host and user.
   */
  public compute(opts: MatchOptions): Record<string, string | string[]>;

  public compute(opts: string | MatchOptions): Record<string, string | string[]> {
    if (typeof opts === 'string') opts = { Host: opts }

    let userInfo: { username: string }
    try {
      userInfo = os.userInfo()
    } catch {
      // os.userInfo() throws a SystemError if a user has no username or homedir.
      userInfo = { username: process.env.USER || process.env.USERNAME || '' }
    }

    const context: ComputeContext = {
      params: {
        Host: opts.Host,
        HostName: opts.Host,
        OriginalHost: opts.Host,
        User: userInfo.username,
        LocalUser: userInfo.username,
      },
      inFinalPass: false,
      doFinalPass: false,
    }

    const obj: Record<string, string | string[]> = {}
    const setProperty = (name: string, value: string | { val: string, separator: string, quoted?: boolean }[]) => {
      let val: string | string[]
      if (Array.isArray(value)) {
        if (/ProxyCommand/i.test(name)) {
          val = value.map(({ val, separator, quoted }) => {
            return `${separator}${quoted ? `"${val.replace(/"/g, '\\"')}"` : val}`
          }).join('').trim()
        } else {
          val = value.map(({ val }) => val)
        }
      } else {
        val = value
      }
      const val0 = Array.isArray(val) ? val[0] : val
      if (REPEATABLE_DIRECTIVES.includes(name)) {
        const list = (obj[name] || (obj[name] = [])) as string[]
        list.push(...([] as string[]).concat(val))
      } else if (obj[name] == null) {
        if (name === 'HostName') {
          context.params.HostName = val0
        } else if (name === 'User') {
          context.params.User = val0
        }
        obj[name] = val
      }
    }

    if (opts.User !== undefined) {
      setProperty('User', opts.User)
    }

    const doPass = () => {
      for (const line of this) {
        if (line.type !== LineType.DIRECTIVE) continue
        if (line.param === 'Host' && glob(Array.isArray(line.value) ? line.value.map(({ val }) => val) : line.value, context.params.Host)) {
          let canonicalizeHostName = false
          let canonicalDomains: string[] = []
          setProperty(line.param, line.value)
          for (const subline of (line as Section).config) {
            if (subline.type === LineType.DIRECTIVE) {
              setProperty(subline.param, subline.value)
              if (/^CanonicalizeHostName$/i.test(subline.param) && subline.value === 'yes') {
                canonicalizeHostName = true
              }
              if (/^CanonicalDomains$/i.test(subline.param) && Array.isArray(subline.value)) {
                canonicalDomains = subline.value.map(({ val }) => val)
              }
            }
          }

          if (canonicalDomains.length > 0 && canonicalizeHostName && context.params.Host === context.params.OriginalHost) {
            for (const domain of canonicalDomains) {
              const host = `${context.params.OriginalHost}.${domain}`
              const { status, stderr } = spawnSync('nslookup', [host])
              if (status === 0 && !/can't find/.test(stderr.toString())) {
                context.params.Host = host
                setProperty('Host', host)
                doPass()
                break
              }
            }
          }
        } else if (line.param === 'Match' && 'criteria' in line && match(line.criteria, context)) {
          for (const subline of (line as Section).config) {
            if (subline.type === LineType.DIRECTIVE) {
              setProperty(subline.param, subline.value)
            }
          }
        } else if (line.param !== 'Host' && line.param !== 'Match') {
          setProperty(line.param, line.value)
        }
      }
    }

    doPass()

    if (context.doFinalPass) {
      context.inFinalPass = true
      context.params.Host = context.params.HostName

      doPass()
    }

    return obj
  }


  /**
   * Find by Host or Match.
   */
  public override find(opts: FindOptions): Line | undefined;

  /**
   * Find by search function.
   * @param predicate Function to check against each line; should return a truthy value when a
   * matching line is given.
   */
  public override find(predicate: (line: Line, index: number, config: Line[]) => unknown): Line | undefined;

  public override find(opts: ((line: Line, index: number, config: Line[]) => unknown) | FindOptions) {
    if (typeof opts === 'function') return super.find(opts)

    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only find by Host or Match')
    }

    return super.find((line: Line) => 'param' in line && compare(line, opts))
  }


  /**
   * Remove section by Host or Match.
   */
  public remove(opts: FindOptions): Line[] | undefined;

  /**
   * Remove section by search function.
   * @param predicate Function to check against each line; should return a truthy value when a
   * matching line is given.
   */
  public remove(predicate: (line: Line, index: number, config: Line[]) => unknown): Line[] | undefined;

  public remove(opts: ((line: Line, index: number, config: Line[]) => unknown) | FindOptions) {
    let index: number

    if (typeof opts === 'function') {
      index = super.findIndex(opts)
    } else if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only remove by Host or Match')
    } else {
      index = super.findIndex((line: Line) => 'param' in line && compare(line, opts))
    }

    if (index >= 0) return this.splice(index, 1)
  }

  /**
   * Convert this SSH config to its textual presentation via {@link stringify}.
   */
  public override toString(): string {
    return stringify(this)
  }

  /**
   * Append new section to existing SSH config.
   */
  public append(opts: Record<string, string | string[]>): SSHConfig {
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
        value: Array.isArray(value) ? value.map((val, i) => ({ val, separator: i === 0 ? '' : ' ' })) : value,
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
   * Prepend new section to existing SSH config.
   */
  public prepend(opts: Record<string, string | string[]>, beforeFirstSection = false): SSHConfig {
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
        value: Array.isArray(value) ? value.map((val, i) => ({ val, separator: i === 0 ? '' : ' ' })) : value,
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
 * Parse SSH config text into structured object.
 */
export function parse(text: string | Buffer): SSHConfig {
  // Handle Buffer input by converting to string
  const input: string = typeof text === 'string' ? text : text.toString('utf-8')

  let i = 0
  let chr = next()
  let config: SSHConfig = new SSHConfig()
  let configWas = config

  function next() {
    return input[i++]
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
      else if (chr === '#' && !quoted) {
        break
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
    const results: { val: string, separator: string, quoted: boolean }[] = []
    let val = ''
    // whether current value is quoted or not
    let valQuoted = false
    // the separator preceding current value
    let valSeparator = ' '
    // whether current context is within quotations or not
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
        valQuoted = true
      }
      else if (/[ \t=]/.test(chr)) {
        if (val) {
          results.push({ val, separator: valSeparator, quoted: valQuoted })
          val = ''
          valQuoted = false
          valSeparator = chr
        }
        // otherwise ignore the space
      }
      else if (chr === '#' && results.length > 0) {
        break
      }
      else {
        val += chr
      }

      chr = next()
    }

    if (quoted || escaped) {
      throw new Error(`Unexpected line break at ${results.map(({ val }) => val).concat(val).join(' ')}`)
    }
    if (val) results.push({ val, separator: valSeparator, quoted: valQuoted })
    return results.length > 1 ? results : results[0].val
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
      const criteria: Match['criteria'] = {}

      if (typeof result.value === 'string') {
        result.value = [{ val: result.value, separator: '', quoted: result.quoted }]
      }

      let i = 0
      while (i < result.value.length) {
        const { val: keyword } = result.value[i]

        switch (keyword.toLowerCase()) {
          case 'all':
          case 'canonical':
          case 'final':
            criteria[keyword] = []
            i += 1
            break
          default:
            if (i + 1 >= result.value.length) {
              throw new Error(`Missing value for match criteria ${keyword}`)
            }
            criteria[keyword] = result.value[i + 1].val
            i += 2
            break
        }
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
      if (config.length === 0) {
        if (configWas.length === 0) {
          configWas.push({ type: LineType.EMPTY, before: '', after: node.before })
        } else {
          configWas[configWas.length - 1].after += node.before
        }
      } else {
        config[config.length - 1].after += node.before
      }
    }
    else {
      config.push(node)
    }
  }

  return configWas
}

/**
 * Stringify structured object into SSH config text.
 */
export function stringify(config: SSHConfig): string {
  let str = ''

  function formatValue(value: string | string[] | Record<string, any>, quoted: boolean) {
    if (Array.isArray(value)) {
      let result = ''
      for (const { val, separator, quoted } of value) {
        result += (result ? separator : '') + formatValue(val, quoted || RE_SPACE.test(val))
      }
      return result
    }
    return quoted ? `"${value}"` : value
  }

  function formatDirective(line: Directive) {
    const quoted = line.quoted
      || (RE_QUOTE_DIRECTIVE.test(line.param) && typeof line.value === 'string' && RE_SPACE.test(line.value))
    const value = formatValue(line.value, quoted)
    return `${line.param}${line.separator}${value}`
  }

  const format = (line: Line) => {
    str += line.before

    if (line.type === LineType.COMMENT) {
      str += line.content
    }
    else if (line.type === LineType.DIRECTIVE && REPEATABLE_DIRECTIVES.includes(line.param)) {
      (Array.isArray(line.value) ? line.value : [line.value]).forEach((value, i, values) => {
        str += formatDirective({ ...line, value: typeof value !== 'string' ? value.val : value })
        if (i < values.length - 1) str += `\n${line.before}`
      })
    }
    else if (line.type === LineType.DIRECTIVE) {
      str += formatDirective(line)
    }

    str += line.after

    if ('config' in line) {
      line.config.forEach(format)
    }
  }

  config.forEach(format)

  return str
}

export { glob, SSHConfig }
