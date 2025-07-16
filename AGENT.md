# AGENT.md - Tab Group Automator Extension

## Build/Test Commands
- `npm run build` - Build Tailwind CSS for production (minified)
- `npm run watch` - Watch and rebuild CSS on changes
- `npm run package` - Build extension and create Firefox/Chrome .zip packages in dist/
- No test command configured (shows "Error: no test specified")

## Architecture
Browser extension (WebExtension) compatible with Firefox and Chrome. Main components:
- `background.js` - Service worker, main entry point, handles tab events and queue processing
- `grouping-logic.js` - Core tab grouping algorithms and rule processing  
- `settings-manager.js` - Settings persistence and sync management
- `context-menu-manager.js` - Right-click context menu functionality
- `app-state.js` - Application state management
- `popup/` - Extension toolbar popup UI
- `options/` - Extension settings/options page UI
- `manifest.json` - Extension manifest (Firefox), `manifest-chromium.json` for Chrome

## Code Style
- ES6 modules with `import/export` syntax
- JSDoc comments for file headers: `@file filename.js @description Purpose`
- Portuguese comments and strings throughout codebase
- Browser API polyfill: `import "./vendor/browser-polyfill.js"`
- Tailwind CSS with dark mode support (class strategy)
- Constants in UPPER_CASE, camelCase for variables/functions
- Logger module for consistent logging: `Logger.info/error/debug()`
