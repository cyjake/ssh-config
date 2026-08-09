const { writeFileSync } = require('node:fs')

writeFileSync('lib/package.json', '{"type":"module"}\n')
writeFileSync('dist/package.json', '{"type":"commonjs"}\n')
