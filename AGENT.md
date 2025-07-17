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
- `error-handler.js` - Legacy error handling system (maintained for compatibility)
- `adaptive-error-handler.js` - **NEW**: Advanced adaptive error handling with contextual strategies
- `memory-manager.js` - Legacy memory management system (maintained for compatibility)
- `adaptive-memory-manager.js` - Advanced adaptive memory management with pressure detection
- `intelligent-cache-manager.js` - **NEW**: Advanced cache system with TTL, versioning and auto-invalidation
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

### Adaptive Error Handling
- **Contextual Strategies**: 9 different recovery strategies based on error type and operation context
- **Backoff Algorithms**: 5 specialized algorithms (immediate, linear, exponential, fibonacci, jittered)
- **Error Classification**: 15 categorized error types for specific handling (network, permission, API, etc.)
- **Circuit Breaker**: Intelligent system to prevent repeated failures with automatic reset
- **Contextual Configuration**: Different retry limits and multipliers per operation context
- **Recovery Optimization**: Up to 70% faster recovery from transient errors

### Intelligent Cache Management
- **TTL-Based Expiration**: Configurable time-to-live for cache entries with automatic cleanup
- **Auto-Invalidation**: Automatic cache invalidation based on tab changes and domain modifications
- **Rich Metadata**: Storage of confidence levels, source information, timestamps and contextual data
- **LRU Eviction**: Least Recently Used algorithm for intelligent memory management
- **Version Control**: Cache versioning system that invalidates incompatible entries after updates
- **Domain Change Tracking**: Pattern monitoring for proactive invalidation of frequently changing domains
- **Usage Optimization**: Algorithm that removes rarely accessed entries to maintain performance
- **Dual Compatibility**: Simultaneous support for legacy and intelligent cache during transition

## Code Style
- ES6 modules with `import/export` syntax
- JSDoc comments for file headers: `@file filename.js @description Purpose`
- Portuguese comments and strings throughout codebase
- Browser API polyfill: `import "./vendor/browser-polyfill.js"`
- Tailwind CSS with dark mode support (class strategy)
- Constants in UPPER_CASE, camelCase for variables/functions
- Logger module for consistent logging: `Logger.info/error/debug()`
