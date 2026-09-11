import mongoose from 'mongoose';
import { loadServerEnv } from '@/lib/env';

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { _mongooseCache?: ConnectionCache };

const cache: ConnectionCache = globalForMongoose._mongooseCache ?? { conn: null, promise: null };
globalForMongoose._mongooseCache = cache;

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const resolvedUri = uri ?? loadServerEnv().MONGODB_URI;

  // Serverless: a lambda handles one request at a time but is reused, so the
  // connection is cached across invocations. A *failed* connect must never be
  // cached — one bad cold start would otherwise poison that instance for the
  // rest of its life, and every later request would re-await the same rejected
  // promise instead of retrying.
  cache.promise ??= mongoose.connect(resolvedUri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    cache.conn = null;
    throw error;
  }

  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return;

  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
