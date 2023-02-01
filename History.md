4.2.1 / 2023-02-01
==================

## What's Changed
* fix: not matched sections should not present in compute result by @cyjake in https://github.com/cyjake/ssh-config/pull/63


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.2.0...v4.2.1

4.2.0 / 2023-01-04
==================

## What's Changed
* feat: parse Match criteria into an object by @cyjake in https://github.com/cyjake/ssh-config/pull/59
* refactor: migrate to typescript by @cyjake in https://github.com/cyjake/ssh-config/pull/60


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.6...v4.2.0

4.1.6 / 2022-06-30
==================

## What's Changed
* Allow to remove section by function by @colas31 in https://github.com/cyjake/ssh-config/pull/57

## New Contributors
* @colas31 made their first contribution in https://github.com/cyjake/ssh-config/pull/57

**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.5...v4.1.6

4.1.5 / 2022-06-05
==================

## What's Changed
* docs: config.push(...config)

**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.4...v4.1.5

4.1.4 / 2022-04-02
==================

## What's Changed
* fix: declaration of sshConfig.find() by @cyjake in https://github.com/cyjake/ssh-config/pull/55


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.3...v4.1.4

4.1.3 / 2022-03-11
==================

## What's Changed
* fix: IdentityAgent should be quoted if necessary by @cyjake in https://github.com/cyjake/ssh-config/pull/52


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.2...v4.1.3

4.1.2 / 2022-01-20
==================

## What's Changed
* docs: types field in package.json by @cyjake in https://github.com/cyjake/ssh-config/pull/50


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.1...v4.1.2

4.1.1 / 2021-10-21
==================

## What's Changed
* docs: `.prepend` and type definitions by @cyjake in https://github.com/cyjake/ssh-config/pull/47
* fix: improper parsing of ProxyCommand with quotation marks by @tanhakabir in https://github.com/cyjake/ssh-config/pull/48


**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.1.0...v4.1.1

4.1.0 / 2021-10-20
==================

## What's Changed
* test: switching to github actions by @cyjake in https://github.com/cyjake/ssh-config/pull/44
* feat: add prepend function to prepend options onto config by @tanhakabir in https://github.com/cyjake/ssh-config/pull/45
* build: switch to codecov by @cyjake in https://github.com/cyjake/ssh-config/pull/46

## New Contributors
* @tanhakabir made her first contribution in https://github.com/cyjake/ssh-config/pull/45

**Full Changelog**: https://github.com/cyjake/ssh-config/compare/v4.0.6...v4.1.0

4.0.6 / 2021-05-11
==================

 * fix: IdentityFile parameter value should be quoted if contains space


4.0.5 / 2021-01-08
==================

 * fix: multiple LocalForward values should be formartted into multiple lines


4.0.4 / 2020-09-01
==================

 * fix: should not quote directives like LocalForward (#38)


4.0.3 / 2020-08-24
==================

 * fix: quote values that contain white spaces (36)


4.0.2 / 2020-02-09
==================

 * fix: 'compute' fails when hosts contain regex chars #34 @roblourens


4.0.1 / 2020-02-01
==================

 * Fix: parsing `Host` values with trailing spaces


4.0.0 / 2020-01-09
==================

 * Fix: allow forwarding directives (and `CertificateFile`) to have multiple values (#30)


3.0.1 / 2020-01-07
==================

 * Fix: append new section to empty config (#27)


3.0.0 / 2019-12-12
==================

 * Breaking: prefer to separate sections with `\n\n` (#23, #24)
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

