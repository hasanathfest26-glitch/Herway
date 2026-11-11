import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  getAllowedCorsOrigins,
  validateSecurityEnvironment,
} from './common/config/env.validation';

export async function createHerwayApp(): Promise<INestApplication> {
  validateSecurityEnvironment();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: getAllowedCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time-Ms'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  return app;
}
