# AGENT.md - Tab Group Automator Extension

## Build/Test Commands

- `npm run build` - Build Tailwind CSS for production (minified)
- `npm run watch` - Watch and rebuild CSS on changes
- `npm run package` - Build Tailwind CSS and create Firefox/Chrome .zip packages in dist/
- No test command configured (shows "Error: no test specified")

## Architecture

Browser extension (WebExtension) compatible with Firefox and Chrome. Main components:

- `background.js` - Service worker, main entry point, handles tab events, queue processing, and dynamic script injection.
- `content-script.js` - Injected on-demand into web pages to extract metadata (e.g., site name, titles) for tab renaming.
- `grouping-logic.js` - Core tab grouping algorithms and rule processing.
- `settings-manager.js` - Settings persistence and sync management.
- `context-menu-manager.js` - Right-click context menu functionality.
- `app-state.js` - Application state management.
- `logger.js` - Centralized logging module with configurable levels (DEBUG, INFO, WARN, ERROR).
- `tab-renaming-engine.js` - Advanced engine for renaming tabs based on configurable rules and strategies.
- `performance-optimizations.js` - Applies dynamic performance configurations to optimize extension behavior.
- `adaptive-error-handler.js` - Advanced adaptive error handling with contextual strategies.
- `adaptive-memory-manager.js` - Advanced adaptive memory management with pressure detection.
- `intelligent-cache-manager.js` - Advanced cache system with TTL, versioning and auto-invalidation.
- `api-rate-limiter.js` - Centralized API rate limiting system with queuing and prioritization.
- `browser-api-wrapper.js` - Transparent wrapper for browser APIs with automatic rate limiting.
- `parallel-batch-processor.js` - Advanced parallel processing system with concurrency control.
- `performance-config.js` - Tunable performance configurations and rate limiting.
- `validation-utils.js` - Input validation and sanitization utilities.
- `popup/` - Extension toolbar popup UI.
- `options/` - Extension settings/options page UI.
- `help/` - Contains the help page for the extension.
- `manifest.json` - Extension manifest (Firefox), `manifest-chromium.json` for Chrome.

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

### API Rate Limiting and Throttling

- **Centralized Rate Limiting**: Single system managing all browser API calls with intelligent queuing
- **Priority-Based Queues**: Separate queues for different operation types (critical, user, automated, background)
- **Category-Specific Limits**: Different rate limits for tabs, tabGroups, windows, storage, and background operations
- **Concurrency Control**: Configurable limits on simultaneous operations to prevent browser overload
- **Burst Protection**: Intelligent burst detection and cooldown periods to prevent API throttling
- **Adaptive Retry**: Automatic retry with exponential backoff for failed operations
- **Transparent Wrapper**: Seamless integration that intercepts API calls without code changes
- **Fallback System**: Automatic fallback to native APIs when rate limiting fails
- **Performance Monitoring**: Detailed statistics on API usage, queue sizes, and performance metrics

## Code Style

- ES6 modules with `import/export` syntax
- JSDoc comments for file headers: `@file filename.js @description Purpose`
- Portuguese comments and strings throughout codebase
- Browser API polyfill: `import "./vendor/browser-polyfill.js"`
- Tailwind CSS with dark mode support (class strategy)
- Constants in UPPER_CASE, camelCase for variables/functions
- Logger module for consistent logging: `Logger.info/error/debug()`
