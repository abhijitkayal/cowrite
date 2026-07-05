import mongoose from "mongoose";

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  throw new Error("MONGODB_URI is required");
}

const uri: string = mongodbUri;

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: CachedConnection;
};

const cache =
  globalForMongoose.mongooseCache ??
  (globalForMongoose.mongooseCache = { conn: null, promise: null });

export async function connectDb() {
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false
  });

  cache.conn = await cache.promise;
  return cache.conn;
}
