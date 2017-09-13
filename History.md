1.1.1 / 2017-09-13
==================

 * Fix: values of `IdentityFile` will now be quoted if contain space.
 * Fix: quoted values will have their double quotations stripped while parsed, which is a slightly breaking behavior but I think a patch version will just be fine.


1.1.0 / 2017-09-07
==================

 * New: config.append({ Host: '*' })

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
 