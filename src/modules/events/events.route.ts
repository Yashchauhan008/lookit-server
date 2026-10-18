import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import { requireAuth } from '@/shared/middlewares/require-auth.js';

import {
    Controller as listEvents,
} from '@/modules/events/controllers/list-events.js';
import {
    Controller as createEvent,
    ValidationSchema as createEventSchema,
} from '@/modules/events/controllers/create-event.js';
import {
    Controller as getEvent,
    ValidationSchema as getEventSchema,
} from '@/modules/events/controllers/get-event.js';
import {
    Controller as updateEvent,
    ValidationSchema as updateEventSchema,
} from '@/modules/events/controllers/update-event.js';
import {
    Controller as deleteEvent,
    ValidationSchema as deleteEventSchema,
} from '@/modules/events/controllers/delete-event.js';
import {
    Controller as getEventQr,
    ValidationSchema as getEventQrSchema,
} from '@/modules/events/controllers/get-event-qr.js';
import uploadsRoutes from '@/modules/uploads/uploads.route.js';

const router = Router();

router.use(requireAuth);

router.route('/').get(withDatabase(listEvents)).post(validate(createEventSchema), withDatabase(createEvent));

router
    .route('/:id')
    .get(validate(getEventSchema), withDatabase(getEvent))
    .patch(validate(updateEventSchema), withDatabase(updateEvent))
    .delete(validate(deleteEventSchema), withDatabase(deleteEvent));

router.route('/:id/qr').get(validate(getEventQrSchema), withDatabase(getEventQr));

router.use('/:id', uploadsRoutes);

export default router;
