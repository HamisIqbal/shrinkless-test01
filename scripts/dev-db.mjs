/**
 * Local MongoDB for development, for when Atlas is unreachable (a laptop off
 * the allowlisted network, a plane, a broken resolver). Reuses the binary
 * mongodb-memory-server already caches for the test suite, but keeps its data
 * in `.mongo-data/` so a restart does not wipe the store.
 *
 *   npm run dev:db          # leave running in its own terminal
 *   MONGODB_URI=mongodb://127.0.0.1:27017/shrinkless npm run seed:products
 *
 * Standalone, not a replica set: nothing in the app opens a transaction yet.
 */
import { mkdirSync } from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.DEV_DB_PORT ?? 27017);
const DB_PATH = '.mongo-data';

mkdirSync(DB_PATH, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: PORT, dbPath: DB_PATH, storageEngine: 'wiredTiger' },
});

const uri = `mongodb://127.0.0.1:${PORT}/shrinkless`;
console.log(`\nMongoDB up, data in ${DB_PATH}/\n\n  MONGODB_URI="${uri}"\n\nPut that in .env.local, then seed:\n  npm run seed:products && npm run seed:admin\n\nCtrl-C to stop.\n`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
