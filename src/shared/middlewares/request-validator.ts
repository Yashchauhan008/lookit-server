import z from 'zod';
import type { Request, Response, NextFunction } from 'express';
import qs from 'qs';
import { validate } from '@/shared/helpers/validation.helper.js';

function parseQuery(req: Request) {
    const rawQuery = req.url.split('?')[1] || '';
    return qs.parse(rawQuery);
}

const validateRequest = (schema: { [key: string]: z.ZodObject<any, any> } ) => (req: Request, res: Response, next: NextFunction) => {
    req.body = req.body || {};

    Object.keys(schema).forEach((key) => {
        const result = key === 'query' ? validate(schema[key], parseQuery(req)) : validate(schema[key], req[key]);

        if (key === 'query') (req as Request & { validatedQuery: object }).validatedQuery = result;
        else (req as any)[key] = result;
    });

    next();

};

export default validateRequest;
