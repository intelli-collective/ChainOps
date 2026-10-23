import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('monitoring routes registered in AppModule', () => {
  let app: INestApplication;
  const projectId = '05d2496e-5fa4-4d7a-9606-7dd98d154e4b';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['get', 'monitored-contracts'],
    ['post', 'monitored-contracts'],
    ['get', 'alert-rules'],
    ['post', 'alert-rules'],
    ['get', 'monitoring/overview'],
    ['get', 'monitoring/watchers'],
    ['get', 'monitoring/events'],
    ['get', 'monitoring/rules'],
    ['get', 'monitoring/alerts'],
    ['post', 'monitoring/targets'],
  ] as const)(
    '%s /projects/:projectId/%s reaches the authentication guard',
    async (method, resource) => {
      // No authentication override: a registered protected route must reject with
      // 401 before any database access; an omitted controller instead returns 404.
      const response = await request(app.getHttpServer())
        [method](`/projects/${projectId}/${resource}`)
        .expect(401);
      expect(response.body.message).toBe('A Bearer access token is required');
    },
  );
});
