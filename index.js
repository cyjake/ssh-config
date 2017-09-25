'use strict'

const glob = require('./lib/glob')

const RE_SPACE = /\s/
const RE_LINE_BREAK = /\r|\n/
const RE_SECTION_DIRECTIVE = /^(Host|Match)$/i
const RE_QUOTED = /^(")(.*)\1$/

const DIRECTIVE = 1
const COMMENT = 2


class SSHConfig extends Array {
  /**
   * Query ssh config by host.
   *
   * @return {Object} The applied options of current Host
   */
  compute(host) {
    let obj = {}
    let setProperty = (name, value) => {
      if (name === 'IdentityFile') {
        let list = obj[name] || (obj[name] = [])
        list.push(value)
      }
      else if (obj[name] === undefined) {
        obj[name] = value
      }
    }

    for (let i = 0; i < this.length; i++) {
      let line = this[i]

      if (line.type !== DIRECTIVE) {
        continue
      }
      else if (line.param === 'Host') {
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
  find(opts) {
    let result = this.constructor.find(this, opts)
    return result ? result[0] : null
  }


  /**
   * Remove section
   */
  remove(opts) {
    let result = this.constructor.find(this, opts)

    if (result) {
      return this.splice(result[1], 1)
    }
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
    let config = this
    let configWas = this
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
        config.push(line)
        config = line.config = new SSHConfig()
      } else {
        line.before = indent
        config.push(line)
      }
    }

    config[config.length - 1].after += '\n'

    return configWas
  }


  static find(config, opts) {
    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only find by Host or Match')
    }

    for (let i = 0; i < config.length; i++) {
      const line = config[i]

      if (line.type === DIRECTIVE &&
          RE_SECTION_DIRECTIVE.test(line.param) &&
          line.param in opts &&
          opts[line.param] === line.value) {
        return [line, i]
      }
    }

    return null
  }


  /**
   * Stringify structured object into ssh config text
   */
  static stringify(config) {
    let str = ''

    let format = line => {
      str += line.before

      if (line.type === COMMENT) {
        str += line.content
      }
      else if (line.type === DIRECTIVE) {
        str += line.quoted || (line.param == 'IdentityFile' && RE_SPACE.test(line.value))
          ? `${line.param}${line.separator}"${line.value}"`
          : `${line.param}${line.separator}${line.value}`
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

    function option() {
      let opt = ''

      while (chr && chr !== ' ' && chr !== '=') {
        opt += chr
        chr = next()
      }

      return opt
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

      while (chr && !RE_LINE_BREAK.test(chr)) {
        val += chr
        chr = next()
      }

      return val.trim()
    }

    function comment() {
      let type = COMMENT
      let content = ''

      while (chr && !RE_LINE_BREAK.test(chr)) {
        content += chr
        chr = next()
      }

      return { type, content }
    }

    function directive() {
      let type = DIRECTIVE

      return {
        type,
        param: option(),
        separator: separator(),
        value: value()
      }
    }

    function line() {
      let before = space()
      let node = chr === '#' ? comment() : directive()
      let after = linebreak()

      node.before = before
      node.after = after

      if (RE_QUOTED.test(node.value)) {
        node.value = node.value.replace(RE_QUOTED, '$2')
        node.quoted = true
      }

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
