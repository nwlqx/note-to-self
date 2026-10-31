// Local preview: builds the app into docs/, then serves that folder.
import { context } from 'esbuild';

await import('./build.mjs');

const ctx = await context({});
const { port } = await ctx.serve({ servedir: 'docs', port: Number(process.env.PORT) || 8000 });
console.log(`note to self running at http://localhost:${port}/`);
