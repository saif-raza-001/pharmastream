import prisma from './prisma';

// Get next number for a counter (invoice, purchase, etc.)
export async function getNextNumber(counterName: string): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { name: counterName },
    update: { value: { increment: 1 } },
    create: { name: counterName, value: 1 }
  });
  return counter.value;
}

// Initialize counters if not exists
export async function initializeCounters() {
  const counters = ['invoice', 'purchase', 'receipt', 'payment'];
  
  for (const name of counters) {
    await prisma.counter.upsert({
      where: { name },
      update: {},
      create: { name, value: 0 }
    });
  }
}
