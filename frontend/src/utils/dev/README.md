# Development Utilities

This directory contains development-only utilities that are excluded from production builds.

## Files

- `integrationTestSuite.ts` - Integration testing suite for the application
- `testRunner.ts` - Test runner utilities and helpers
- `serviceWorkerDebug.ts` - Service worker debugging utilities
- `telegramMock.ts` - Mock Telegram API for development
- `performanceTesting.ts` - Performance testing utilities
- `repeatIntegrationTest.ts` - Repeat functionality integration tests
- `statisticsTest.ts` - Statistics component testing utilities
- `unifiedStoreTest.ts` - Unified store testing utilities

## Build Configuration

These files are excluded from production builds via the build configuration that excludes `utils/dev/*` patterns.

## Usage

These utilities should only be imported and used in development environments. Production code should not reference these files.