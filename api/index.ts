import type { Request, Response } from 'express';
import { createApp } from '../server.js';

let appInstance: ((req: Request, res: Response) => void) | null = null;

export default async function handler(req: Request, res: Response) {
  if (!appInstance) {
    const app = await createApp();
    appInstance = app as unknown as (req: Request, res: Response) => void;
  }
  return appInstance(req, res);
}
