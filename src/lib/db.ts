import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { instrumentPrisma } from './server/prismaMonitor';

// Prisma 7 requires a driver adapter. Connection URL comes from PAGE
// environment (.env / .env.local — never hardcoded, never committed).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.');
  }
  const adapter = new PrismaPg({
    connectionString,
    // Local dev: moderate pool, short connection timeout.
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const client = new PrismaClient({
    adapter,
    // Enable query events so the slow-query monitor (prismaMonitor) observes
    // durations; it only emits a structured line for queries >= 200 ms.
    log: ['query', 'warn', 'error'],
  });
  instrumentPrisma(client);
  return client;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}