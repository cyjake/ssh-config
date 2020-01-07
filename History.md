3.0.1 / 2020-01-07
==================

 * Fix: append new section to empty config


3.0.0 / 2019-12-12
==================

 * Breaking: prefer to separate sections with `\n\n`
 * Breaking: drop `SSHConfig.find()`, please use `SSHConfig.prototype.find()` instead


2.0.0 / 2019-10-08
==================

 * Breaking: parse `Host` values as an Array to hold multiple patterns
 * Breaking: an extra line break will always be added when `.append()`ing config
 * Fix: `Host` can contain spaces if quoted with double quotes
 * Fix: quoted values can contain double quotes once they are escaped with backslash
 * Fix: escape + when converting patterns to regexp
 * Fix: parameter/value pairs separated with tab charactor


1.1.6 / 2019-04-02
==================

 * Fix: appending to empty config


1.1.5 / 2018-12-06
==================

 * Fix: auto insert newline when `.append()`ing existing config without trailing newlines. #15


1.1.3 / 2017-09-25
==================

 * Fix: appended config shall comply with existing style, otherwhise default to two spaces. Also an extra linebreak is added after the last line.


1.1.2 / 2017-09-22
==================

 * Fix: nagate patterns shall be matched first and fail early


1.1.1 / 2017-09-13
==================

 * Fix: values of `IdentityFile` will now be quoted if contain space.
 * Fix: quoted values will have their double quotations stripped while parsed, which is a slightly breaking behavior but I think a patch version will just be fine.


1.1.0 / 2017-09-07
==================

 * New: `config.append({ Host: '*' })`

Allow appending sections via `config.append({ ... })` method. Closes #12.


1.0.1 / 2017-02-06
==================

 * Fix: trim spaces at value beginning and endding
 * Fix: make example east more compact


1.0.0 / 2016-05-05
==================

 * Fix: updated readme to be reflect 1.x changes
 * Breaking: parse into a simple ast

This is a breaking change. The parse result is now a subclass of Array instead of vanila Object.


0.2.1 / 2015-11-17
==================

 * Fix: code style and one more test case
 * Merge pull request #7 from petemill/fix-leading-newline
 * Only add a newline between sections if there are previous lines. Fixes https://github.com/dotnil/ssh-config/issues/6


0.2.0 / 2015-07-07
==================

 * Added converage with istanbul
 * Added .append, .find, and .remove; fixes #4
 * Added documentations about said methods
 * Added badges about npm downloads, version, and build status
 * Added .travis.yml
 * Implemented .query and support pattern matching (poorly)


0.1.0 / 2015-01-12
==================

 * Init repo
 * Implemented `.parse` and `.stringify`

