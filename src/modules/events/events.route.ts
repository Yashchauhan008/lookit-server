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
import {
    Controller as setEventBanner,
    ValidationSchema as setEventBannerSchema,
} from '@/modules/events/controllers/set-event-banner.js';
import {
    Controller as deleteEventBanner,
    ValidationSchema as deleteEventBannerSchema,
} from '@/modules/events/controllers/delete-event-banner.js';
import { bannerUpload, bannerUploadError } from '@/modules/events/middlewares/banner-upload.js';
import {
    Controller as getEventScans,
    ValidationSchema as getEventScansSchema,
} from '@/modules/events/controllers/get-event-scans.js';
import { Controller as getInsights } from '@/modules/events/controllers/get-insights.js';
import uploadsRoutes from '@/modules/uploads/uploads.route.js';

const router = Router();

router.use(requireAuth);

router.route('/').get(withDatabase(listEvents)).post(validate(createEventSchema), withDatabase(createEvent));

router.get('/insights', withDatabase(getInsights));
router.get('/:id/scans', validate(getEventScansSchema), withDatabase(getEventScans));

router
    .route('/:id')
    .get(validate(getEventSchema), withDatabase(getEvent))
    .patch(validate(updateEventSchema), withDatabase(updateEvent))
    .delete(validate(deleteEventSchema), withDatabase(deleteEvent));

router.route('/:id/qr').get(validate(getEventQrSchema), withDatabase(getEventQr));

router
    .route('/:id/banner')
    .post(
        bannerUpload.single('banner'),
        bannerUploadError,
        validate(setEventBannerSchema),
        withDatabase(setEventBanner),
    )
    .delete(validate(deleteEventBannerSchema), withDatabase(deleteEventBanner));

router.use('/:id', uploadsRoutes);

export default router;
