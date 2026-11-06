import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite (in-memory Postgres) starts in beforeAll; under a parallel workspace run that can take
    // longer than vitest's 10 s default and fail the suite intermittently.
    hookTimeout: 30_000,
  },
});
