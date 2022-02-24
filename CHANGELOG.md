# Change Log

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2022-02-23

### Added

- Ability to open directories in a new window

## [0.2.0] - 2022-02-23

### Added

- Ability to add a directory to the workspace by selecting "."
- Default keybinding "Ctrl+Shift+O"

### Changed

- Fuzzy matching algorithm from fuse.js to a modified Smith-Waterman-based algorithm
- Default location to home directory when neither an open file nor a workspace folder could be found

## [0.1.0] - 2022-02-18

- Initial release

[unreleased]: https://github.com/maximsmol/open-by-path/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/maximsmol/open-by-path/releases/tag/v0.3.0
[0.2.0]: https://github.com/maximsmol/open-by-path/releases/tag/v0.2.0
[0.1.0]: https://github.com/maximsmol/open-by-path/releases/tag/v0.1.0
