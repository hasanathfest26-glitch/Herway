import { createHerwayApp } from './app.setup';

async function bootstrap() {
  const app = await createHerwayApp();
  const port = Number(process.env.BACKEND_PORT || 3001);
  await app.listen(port);
  console.log(`Herway NestJS API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
