import { PrismaClient } from '@prisma/client';

console.log('=== Prisma Module Loading ===');
console.log('DATABASE_URL at load time:', process.env.DATABASE_URL);

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// Test connection on first use
prisma.$connect()
  .then(() => console.log('✅ Prisma connected to database'))
  .catch((err: Error) => console.error('❌ Prisma connection failed:', err.message));

export default prisma;
