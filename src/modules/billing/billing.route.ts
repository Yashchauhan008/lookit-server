import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import { requireAdmin, requireAuth } from '@/shared/middlewares/require-auth.js';

import { Controller as listPlans } from './controllers/list-plans.js';
import { Controller as getSummary } from './controllers/get-summary.js';
import {
    Controller as createOrder,
    ValidationSchema as createOrderSchema,
} from './controllers/create-order.js';
import { Controller as activateFreePlan } from './controllers/activate-free-plan.js';
import { Controller as adminOverview } from './controllers/admin-overview.js';
import {
    Controller as adminListUsers,
    ValidationSchema as adminListUsersSchema,
} from './controllers/admin-list-users.js';
import {
    Controller as adminGetUser,
    ValidationSchema as adminGetUserSchema,
} from './controllers/admin-get-user.js';
import {
    Controller as adminGrantPlan,
    ValidationSchema as adminGrantPlanSchema,
} from './controllers/admin-grant-plan.js';
import {
    Controller as adminListOrders,
    ValidationSchema as adminListOrdersSchema,
} from './controllers/admin-list-orders.js';
import {
    Controller as adminReviewOrder,
    ValidationSchema as adminReviewOrderSchema,
} from './controllers/admin-review-order.js';
import {
    Controller as adminRevokePurchase,
    ValidationSchema as adminRevokePurchaseSchema,
} from './controllers/admin-revoke-purchase.js';

/** Customer billing, mounted at /billing. */
export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.get('/plans', withDatabase(listPlans));
billingRouter.get('/summary', withDatabase(getSummary));
billingRouter.post('/free-plan', withDatabase(activateFreePlan));
billingRouter.post('/orders', validate(createOrderSchema), withDatabase(createOrder));

/** Admin operations, mounted at /admin. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/overview', withDatabase(adminOverview));
adminRouter.get('/users', validate(adminListUsersSchema), withDatabase(adminListUsers));
adminRouter.get('/users/:id', validate(adminGetUserSchema), withDatabase(adminGetUser));
adminRouter.post('/users/:id/grants', validate(adminGrantPlanSchema), withDatabase(adminGrantPlan));
adminRouter.get('/orders', validate(adminListOrdersSchema), withDatabase(adminListOrders));
adminRouter.post('/orders/:id/review', validate(adminReviewOrderSchema), withDatabase(adminReviewOrder));
adminRouter.post(
    '/purchases/:id/revoke',
    validate(adminRevokePurchaseSchema),
    withDatabase(adminRevokePurchase),
);
