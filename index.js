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

  Object.defineProperties(config, {
    length: {
      value: hostsIndex,
      enumerable: false
    },
    query: {
      value: query,
      enumerable: false
    }
  })

  return config
}


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

