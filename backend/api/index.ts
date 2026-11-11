import type { Request, Response } from 'express';
import { createHerwayApp } from '../src/app.setup';

let cachedExpressApp: ((req: Request, res: Response) => void) | null = null;
let initPromise: Promise<(req: Request, res: Response) => void> | null = null;

async function getExpressHandler(): Promise<(req: Request, res: Response) => void> {
  if (cachedExpressApp) return cachedExpressApp;
  if (!initPromise) {
    initPromise = (async () => {
      const app = await createHerwayApp();
      await app.init();
      const instance = app.getHttpAdapter().getInstance() as (
        req: Request,
        res: Response,
      ) => void;
      cachedExpressApp = instance;
      return instance;
    })();
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  const expressApp = await getExpressHandler();
  return expressApp(req, res);
}
