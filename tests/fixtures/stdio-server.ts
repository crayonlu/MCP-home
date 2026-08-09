import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createFixtureServer, createFixtureState } from './mcp-server.js';

const state = createFixtureState();
const fixtureSecret = process.env.FIXTURE_SECRET ?? null;

if (fixtureSecret) process.stderr.write(`fixture credential: ${fixtureSecret}\n`);

serveStdio(
  (context) =>
    createFixtureServer({
      name: 'home',
      era: context.era,
      secret: fixtureSecret,
      state,
    }),
  { legacy: 'serve' },
);
