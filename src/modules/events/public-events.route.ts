import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import {
    Controller as getPublicEvent,
    ValidationSchema as getPublicEventSchema,
} from '@/modules/events/controllers/get-public-event.js';

const router = Router();

router.route('/:slug').get(validate(getPublicEventSchema), withDatabase(getPublicEvent));

export default router;
