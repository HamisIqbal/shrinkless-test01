import { afterAll, afterEach, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';

export function withTestDatabase(): void {
  let server: MongoMemoryServer | undefined;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await connectToDatabase(server.getUri());

    // Mongoose builds indexes asynchronously. Without waiting, a test that
    // expects a duplicate-key error can run before the unique index exists
    // and see the insert succeed instead.
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    await server?.stop();
  });
}
