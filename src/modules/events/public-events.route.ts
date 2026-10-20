import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import {
    Controller as getPublicEvent,
    ValidationSchema as getPublicEventSchema,
} from '@/modules/events/controllers/get-public-event.js';
import {
    Controller as unlockEvent,
    ValidationSchema as unlockEventSchema,
} from '@/modules/guest/controllers/unlock-event.js';
import {
    Controller as recordConsent,
    ValidationSchema as recordConsentSchema,
} from '@/modules/guest/controllers/record-consent.js';
import {
    Controller as searchBySelfie,
    ValidationSchema as searchBySelfieSchema,
} from '@/modules/guest/controllers/search-by-selfie.js';
import {
    Controller as getMatchedPhotoUrl,
    ValidationSchema as getMatchedPhotoUrlSchema,
} from '@/modules/guest/controllers/get-matched-photo-url.js';
import {
    Controller as getConsentText,
    ValidationSchema as getConsentTextSchema,
} from '@/modules/guest/controllers/get-consent-text.js';
import {
    Controller as getMyResults,
    ValidationSchema as getMyResultsSchema,
} from '@/modules/guest/controllers/get-my-results.js';
import {
    Controller as deleteMyScan,
    ValidationSchema as deleteMyScanSchema,
} from '@/modules/guest/controllers/delete-my-scan.js';
import {
    requireGuest,
    requireGuestConsent,
} from '@/modules/guest/middlewares/require-guest.js';
import {
    selfieUpload,
    selfieUploadError,
} from '@/modules/guest/middlewares/selfie-upload.js';

const router = Router();

router.route('/:slug').get(validate(getPublicEventSchema), withDatabase(getPublicEvent));

router
    .route('/:slug/consent-text')
    .get(validate(getConsentTextSchema), withDatabase(getConsentText));

router
    .route('/:slug/unlock')
    .post(validate(unlockEventSchema), withDatabase(unlockEvent));

router
    .route('/:slug/consent')
    .post(
        requireGuest,
        validate(recordConsentSchema),
        withDatabase(recordConsent),
    );

router
    .route('/:slug/search')
    .post(
        requireGuest,
        requireGuestConsent,
        selfieUpload.single('selfie'),
        selfieUploadError,
        validate(searchBySelfieSchema),
        withDatabase(searchBySelfie),
    );

router.route('/:slug/my-results').post(validate(getMyResultsSchema), withDatabase(getMyResults));

router.route('/:slug/my-scan/delete').post(validate(deleteMyScanSchema), withDatabase(deleteMyScan));

router
    .route('/:slug/photos/:photoId/url')
    .get(
        requireGuest,
        requireGuestConsent,
        validate(getMatchedPhotoUrlSchema),
        withDatabase(getMatchedPhotoUrl),
    );

export default router;
