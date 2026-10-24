import '../env.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { MonitoringWorker } from './monitoring.worker.js';

const app = await NestFactory.createApplicationContext(AppModule);
const worker = app.get(MonitoringWorker);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopping = true;
  });
try {
  while (!stopping) {
    try {
      const processed = await worker.tick();
      if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      console.error(
        'Monitoring queue is unavailable. Verify database configuration and migration 005.',
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
} finally {
  await app.close();
}
