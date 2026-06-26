// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: "server",
  session: {
    driver: sessionDrivers.memory(),
  },
  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare({
    imageService: "passthrough",
    prerenderEnvironment: "node",
  }),
  integrations: [react()]
});
