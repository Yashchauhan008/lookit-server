import z from 'zod';

const uuid = () => z.uuid({ version: 'v7', message: 'Invalid UUID' });

export default {
    uuid,

    phoneNumber: () =>
        z
            .string()
            .trim()
            .regex(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits' }),

    email: () => z.email({ message: 'Invalid email address' }),

    month: () =>
        z.number().int().min(0, 'Month must be greater than 0').max(11, 'Month must be less than 12'),

    year: () =>
        z
            .number()
            .int()
            .min(2000, 'Year must be greater than 2000')
            .max(3000, 'Year must be less than 3000'),

    percentage: () =>
        z
            .number()
            .min(0, 'Percentage must be greater than 0')
            .max(100, 'Percentage must be less than 100'),

    pagination: {
        offset: () => z.coerce.number().int().min(0, 'Offset must be greater than 0').default(0),
        limit: () =>
            z.coerce
                .number()
                .int()
                .min(1, 'Limit must be greater than 0')
                .max(100, 'Limit must be less than 100')
                .default(30),
    },
    sort_orders: (...fields: string[]) =>
        z
            .array(
                z.object({
                    field: z.enum(fields),
                    order: z.enum(['asc', 'desc']),
                }),
            )
            .refine((data) => new Set(data.map((item) => item.field)).size === data.length, {
                message: 'Sort orders must be unique by field',
            }),

    location: () =>
        z.object({
            latitude: z.coerce
                .number()
                .min(-90, 'Latitude must be >= -90')
                .max(90, 'Latitude must be <= 90'),

            longitude: z.coerce
                .number()
                .min(-180, 'Longitude must be >= -180')
                .max(180, 'Longitude must be <= 180'),
        }),
};
