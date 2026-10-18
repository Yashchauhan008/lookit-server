import { v7 as uuidv7 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

const requestId = (req: Request, res: Response, next: NextFunction) => {
    (req as any).id = req.headers['x-request-id'] || uuidv7();
    res.setHeader('X-Request-ID', (req as any).id);
    next();
};

export default requestId;
