// src/types/express.d.ts';

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: any;
      id?: string;
      user?: { id: string};
    }
  }
}

export {};
