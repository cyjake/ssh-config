'use strict'

const glob = require('./lib/glob')

const RE_SPACE = /\s/
const RE_LINE_BREAK = /\r|\n/
const RE_SECTION_DIRECTIVE = /^(Host|Match)$/i
const RE_VALUE_TRIM = /^\s*"?|"?\s*$/g

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


  static find(config, opts) {
    if (!(opts && ('Host' in opts || 'Match' in opts))) {
      throw new Error('Can only find by Host or Match')
    }

    for (let i = 0, len = config.length; i < len; i++) {
      let line = config[i]

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

    let formatValue = value => {
      if (RE_SPACE.test(value)) {
        value = '"' + value + '"'
      }

      return value
    }

    let format = line => {
      str += line.before

      if (line.type === COMMENT) {
        str += line.content
      }
      else if (line.type === DIRECTIVE) {
        str += [line.param, line.separator, formatValue(line.value)].join('')
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

      return val.replace(RE_VALUE_TRIM, '')
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
      let after = space()

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
