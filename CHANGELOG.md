# Changelog

## Unreleased

### Added

- Added `custom` upload name mode with placeholder-based file name templates
- Added placeholder support for upload folder and custom file name template
- Added automatic upload and replacement for pasted and dragged local images when auto replace is enabled

### Changed

- Moved placeholder documentation out of the config panel into the README
- Updated chunk upload rules by channel:
  - Telegram chunks only above `20MB`, default chunk size `16MB`
  - Discord chunks only above `10MB`, default chunk size `8MB`
  - Other channels upload directly by default
