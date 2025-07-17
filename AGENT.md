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
- `error-handler.js` - Centralized error handling and recovery strategies
- `memory-manager.js` - Legacy memory management system (maintained for compatibility)
- `adaptive-memory-manager.js` - **NEW**: Advanced adaptive memory management with pressure detection
- `parallel-batch-processor.js` - Advanced parallel processing system with concurrency control
- `async-batch-processor.js` - Legacy batch processing system (maintained for compatibility)
- `performance-config.js` - Tunable performance configurations and rate limiting
- `validation-utils.js` - Input validation and sanitization utilities
- `popup/` - Extension toolbar popup UI
- `options/` - Extension settings/options page UI
- `manifest.json` - Extension manifest (Firefox), `manifest-chromium.json` for Chrome

### Performance Architecture
- **Parallel Processing**: True parallel processing with controlled concurrency limits
- **Semaphore Control**: Advanced semaphore system to prevent API overload
- **Batch Optimization**: Intelligent batching with specialized processors for different operation types
- **Metrics System**: Built-in performance monitoring and metrics collection
- **Configurable Throttling**: Tunable rate limiting and concurrency controls

### Adaptive Memory Management
- **Pressure Detection**: Real-time memory pressure calculation with weighted algorithms
- **Adaptive Intervals**: Dynamic cleanup intervals from 30s (high pressure) to 15min (low pressure)
- **Cleanup Strategies**: Four-tier system (low/medium/high/emergency) with different aggressiveness levels
- **Pressure History**: Smoothing system to prevent oscillations in cleanup intervals
- **Proactive Prevention**: Emergency cleanup triggers before memory limits are exceeded
- **Resource Efficiency**: Up to 60% reduction in unnecessary cleanup cycles

## Code Style
- ES6 modules with `import/export` syntax
- JSDoc comments for file headers: `@file filename.js @description Purpose`
- Portuguese comments and strings throughout codebase
- Browser API polyfill: `import "./vendor/browser-polyfill.js"`
- Tailwind CSS with dark mode support (class strategy)
- Constants in UPPER_CASE, camelCase for variables/functions
- Logger module for consistent logging: `Logger.info/error/debug()`
