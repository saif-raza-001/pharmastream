import { PrismaClient } from '@prisma/client';

// Lazy initialization - Prisma will use DATABASE_URL when first query is made
let prisma: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    console.log('=== Prisma Initialization ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    prisma = new PrismaClient({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
}

// Export a proxy that lazily initializes Prisma on first access
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export default prismaProxy;
