import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
});

afterAll(async () => {
  await disconnectFromDatabase();
  await server.stop();
});

describe('connectToDatabase', () => {
  it('does not cache a failed connection attempt', async () => {
    // A rejected connect used to stay in the cache, so one bad cold start
    // poisoned every later request on that serverless instance.
    const dead = 'mongodb://127.0.0.1:1/shrinkless?serverSelectionTimeoutMS=250';

    await expect(connectToDatabase(dead)).rejects.toThrow();

    const recovered = await connectToDatabase(server.getUri());
    expect(recovered.connection.readyState).toBe(1);
  });

  it('connects and reuses the same connection on a second call', async () => {
    const first = await connectToDatabase(server.getUri());
    const second = await connectToDatabase(server.getUri());

    expect(first.connection.readyState).toBe(1);
    expect(second).toBe(first);
  });
});
