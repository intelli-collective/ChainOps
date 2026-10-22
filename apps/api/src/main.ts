import './env.js';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import cookieParser from 'cookie-parser';
import { authConfig } from './auth/config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = authConfig();
  app.use(cookieParser());
  app.enableCors({ origin: config.origin, credentials: true, allowedHeaders: ['Content-Type','X-CSRF-Token'] });
  app.use('/auth', (_req: unknown, res: import('express').Response, next: () => void) => { res.setHeader('Cache-Control','no-store'); next(); });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
