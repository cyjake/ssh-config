'use strict';


var RE_SPACE = /\s/


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
    while (chr && chr !== ' ') {
      opt += chr
      next()
    }

    return opt
  }

  function value() {
    var val = ''

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
    var opt = option()
    var val = value()

    if (opt == 'Host') {
      config = configWas
      config = config[hostsIndex++] = {}
    }

    config[opt] = val
  }

  config = configWas
  config.length = hostsIndex

  return config
}


exports.stringify = function(config) {
  var lines = []

  for (var p in config) {
    // If p is number, skip for now. They are host sections. We'll handle them later.
    if (+p < config.length) continue
    if (p == 'length') continue

    lines.push(p + ' ' + config[p])
  }

  for (var i = 0; i < config.length; i++) {
    var section = config[i]

    lines.push('')
    lines.push('Host ' + section.Host)

    for (p in section) {
      if (p == 'Host') continue
      lines.push('  ' + p + ' ' + section[p])
    }
  }

  return lines.join('\n')
}
