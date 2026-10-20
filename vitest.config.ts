import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node.js: no browser, no Firebase and no Asana connection.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
