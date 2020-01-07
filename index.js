'use strict'

const glob = require('./src/glob')

const RE_SPACE = /\s/
const RE_LINE_BREAK = /\r|\n/
const RE_SECTION_DIRECTIVE = /^(Host|Match)$/i

const DIRECTIVE = 1
const COMMENT = 2

function compare(line, opts) {
  return opts.hasOwnProperty(line.param) && opts[line.param] === line.value
}

class SSHConfig extends Array {
  /**
   * Query ssh config by host.
   *
   * @return {Object} The applied options of current Host
   */
  compute(host) {
    const obj = {}
    const setProperty = (name, value) => {
      if (name === 'IdentityFile') {
        const list = obj[name] || (obj[name] = [])
        list.push(value)
      }
      else if (obj[name] == null) {
        obj[name] = value
      }
    }

    for (const line of this) {
      if (line.type !== DIRECTIVE) continue
      if (line.param === 'Host') {
        if (glob(line.value, host)) {
          setProperty(line.param, line.value)

          line.config
            .filter(line => line.type === DIRECTIVE)
            .forEach(line => setProperty(line.param, line.value))
        }
      }
      else if (line.param === 'Match') {
        // TODO
      }
      else {
        setProperty(line.param, line.value)
      }
    }

    return obj
  }

  /**
   * find section by Host or Match
   */
  find(opts = {}) {
    if (typeof opts === 'function') return super.find(opts)

    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only find by Host or Match')
    }

    return super.find(line => compare(line, opts))
  }

  /**
   * Remove section
   */
  remove(opts = {}) {
    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only remove by Host or Match')
    }

    const index = typeof opts === 'function'
      ? super.findIndex(opts)
      : super.findIndex(line => compare(line, opts))

    if (index >= 0) return this.splice(index, 1)
  }

  /**
   * toString()
   */
  toString() {
    return this.constructor.stringify(this)
  }


  /**
   * Append new section to existing ssh config.
   */
  append(opts) {
    let indent = '  '

    outer:
    for (const line of this) {
      if (RE_SECTION_DIRECTIVE.test(line.param)) {
        for (const subline of line.config) {
          if (subline.before) {
            indent = subline.before
            break outer
          }
        }
      }
    }

    const lastEntry = this.length > 0 ? this[this.length - 1] : null
    let config = lastEntry && lastEntry.config || this
    let configWas = this

    let lastLine = config.length > 0 ? config[config.length - 1] : lastEntry
    if (lastLine && !lastLine.after) lastLine.after = '\n'

    for (const param in opts) {
      const line = {
        type: DIRECTIVE,
        param,
        separator: ' ',
        value: opts[param],
        before: '',
        after: '\n'
      }

      if (RE_SECTION_DIRECTIVE.test(param)) {
        config = configWas
        // separate sections with an extra newline
        // https://github.com/cyjake/ssh-config/issues/23#issuecomment-564768248
        if (lastLine && lastLine.after === '\n') lastLine.after += '\n'
        config.push(line)
        config = line.config = new SSHConfig()
      } else {
        line.before = config === configWas ? '' : indent
        config.push(line)
      }
      lastLine = line
    }

    return configWas
  }

  /**
   * Stringify structured object into ssh config text
   */
  static stringify(config) {
    let str = ''

    const formatValue = (value, quoted) => {
      if (Array.isArray(value)) {
        return value.map(chunk => formatValue(chunk, RE_SPACE.test(chunk))).join(' ')
      }

      return quoted ? `"${value}"` : value
    }

    const format = line => {
      str += line.before

      if (line.type === COMMENT) {
        str += line.content
      }
      else if (line.type === DIRECTIVE) {
        const quoted = line.quoted
          || (/IdentityFile/i.test(line.param) && RE_SPACE.test(line.value))
        const value = formatValue(line.value, quoted)
        str += `${line.param}${line.separator}${value}`
      }

      str += line.after

      if (line.config) {
        line.config.forEach(format)
      }
    }

    config.forEach(format)

    return str
  }

  static get DIRECTIVE() {
    return DIRECTIVE
  }

  static get COMMENT() {
    return COMMENT
  }

  /**
   * Parse ssh config text into structured object.
   */
  static parse(str) {
    let i = 0
    let chr = next()
    let config = new SSHConfig()
    let configWas = config

    function next() {
      return str[i++]
    }

    function space() {
      let spaces = ''

      while (RE_SPACE.test(chr)) {
        spaces += chr
        chr = next()
      }

      return spaces
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

    function separator() {
      let sep = space()

      if (chr === '=') {
        sep += chr
        chr = next()
      }

      return sep + space()
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

    function comment() {
      const type = COMMENT
      let content = ''

      while (chr && !RE_LINE_BREAK.test(chr)) {
        content += chr
        chr = next()
      }

      return { type, content }
    }

    // Host *.co.uk
    // Host * !local.dev
    // Host "foo bar"
    function patterns() {
      const results = []
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
      results.push(val)
      return results.length > 1 ? results : results[0]
    }

    function directive() {
      const type = DIRECTIVE
      const param = parameter()
      // Host "foo bar" baz
      const multiple = param.toLowerCase() == 'host'
      const result = {
        type,
        param,
        separator: separator(),
        quoted: !multiple && chr === '"',
        value: multiple ? patterns() : value()
      }
      if (!result.quoted) delete result.quoted
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

      if (node.type === DIRECTIVE && RE_SECTION_DIRECTIVE.test(node.param)) {
        config = configWas
        config.push(node)
        config = node.config = new SSHConfig()
      }
      else {
        config.push(node)
      }
    }

    return configWas
  }
}

module.exports = SSHConfig
