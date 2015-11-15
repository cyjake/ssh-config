'use strict'


var RE_SPACE = /\s/


function glob(pattern, str) {
  var patterns = pattern.split(/\s+/)

  for (var i = 0, len = patterns.length; i < len; i++) {
    var negate = false

    pattern = patterns[i]
    if (pattern.charAt(0) === '!') {
      negate = true
      pattern = pattern.slice(1)
    }
    pattern = pattern.replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.?')
      .replace(/,/g, '|')

    if (negate ^ new RegExp('^(?:' + pattern + ')$').test(str)) {
      return true
    }
  }

  return false
}


/*
 * Query ssh config by host
 */
function query(host) {
  var obj = {}
  var param

  for (param in this) {
    if (+param < this.length) continue
    obj[param] = this[param]
  }

  for (var i = 0, len = this.length; i < len; i++) {
    var section = this[i]

    if (section.Host && glob(section.Host, host)) {
      for (param in section) {
        if (!(param in obj)) obj[param] = section[param]
      }
    }
    else if (section.Match) {
      // TODO
    }
  }

  return obj
}


/*
 * Append new sections to config
 */
function append(section) {
  if (!section || !(section.Host || section.Match)) {
    throw new Error('Only Host or Match can start new section!')
  }

  for (var i = 0, len = this.length; i < len; i++) {
    if (section.Host && this[i].Host === section.Host) {
      throw new Error('Duplicated Host section!')
    }
    else if (section.Match && this[i].Match === section.Match) {
      throw new Error('Duplicated Match section!')
    }
  }

  this[this.length++] = section
  return this
}


/*
 * Find section by Host or Match
 */
function find(opts) {
  if (!opts || !Object.keys(opts).length) {
    throw new Error('No criteria supplied to find!')
  }

  for (var i = 0, len = this.length; i < len; i++) {
    var section = this[i]
    var found = true

    for (var p in opts) {
      if (opts[p] !== section[p]) {
        found = false
        break
      }
    }

    if (found) return section
  }

  return null
}


/*
 * Remove section
 */
var splice = Array.prototype.splice

function remove(opts) {
  if (!opts || !Object.keys(opts).length) {
    throw new Error('No criteria supplied to find and remove!')
  }

  for (var i = this.length - 1; i >= 0; i--) {
    var section = this[i]
    var found = true

    for (var p in opts) {
      if (opts[p] !== section[p]) {
        found = false
        break
      }
    }

    if (found) splice.call(this, i, 1)
  }
}


/*
 * Define helper methods but hide from enumeration.
 */
function defineMethods(config) {
  Object.defineProperties(config, {
    query: {
      value: query,
      enumerable: false
    },
    append: {
      value: append,
      enumerable: false
    },
    find: {
      value: find,
      enumerable: false
    },
    remove: {
      value: remove,
      enumerable: false
    }
  })
}


/*
 * Parse ssh config text into structured object.
 */
exports.parse = function(str) {
  var i = 0
  var chr = next()
  var config = {}

  str = str.trim()

  function next() {
    chr = str[i++]
    return chr
  }

  function space() {
    while (RE_SPACE.test(chr)) {
      next()
    }
  }

  function option() {
    var opt = ''

    space()
    while (chr && chr !== ' ' && chr !== '=') {
      opt += chr
      next()
    }

    return opt
  }

  function value() {
    var val = ''

    space()
    if (chr === '=') next()
    space()

    while (chr && chr !== '\n' && chr !== '\r') {
      val += chr
      next()
    }

    return val
  }

  var hostsIndex = 0
  var configWas = config

  while (chr) {
    var param = option()

    if (param === 'Host' || param === 'Match') {
      config = configWas
      config = config[hostsIndex++] = {}
    }

    config[param] = value()
  }

  config = configWas
  Object.defineProperty(config, 'length', {
    value: hostsIndex,
    writable: true,
    enumerable: false
  })
  defineMethods(config)

  return config
}


/*
 * Stringify structured object into ssh config text
 */
exports.stringify = function(config) {
  var lines = []

  /*
   * Ouput wild parameters first. Only the parameters specified at the file
   * beginning can be outside of any section.
   *
   * According to ssh_config(5), the first obtained value of parameter will
   * be used. It is recommended that the general defaults shall be at the end
   * of the config file, in the `Host *` section.
   *
   * So wild parameters cannot be overridden even if there are sections that
   * match current host. One shall use it with caution.
   */
  for (var p in config) {
    if (+p < config.length) continue
    lines.push(p + ' ' + config[p])
  }

  for (var i = 0; i < config.length; i++) {
    var section = config[i]
    //do not begin with a leading blank line
    if (lines.length !== 0)
      lines.push('')

    for (p in section) {
      if (p === 'Host' || p === 'Match') {
        lines.push(p + ' ' + section[p])
      } else {
        lines.push('  ' + p + ' ' + section[p])
      }
    }
  }

  return lines.join('\n')
}


/*
 * export poor man's glob for unit tests. This is private.
 */
exports.glob = glob

