import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import { requireAuth } from '@/shared/middlewares/require-auth.js';

import {
    Controller as createUploadSession,
    ValidationSchema as createUploadSessionSchema,
} from './controllers/create-upload-session.js';
import {
    Controller as createMultipartUpload,
    ValidationSchema as createMultipartSchema,
} from './controllers/create-multipart-upload.js';
import {
    Controller as signUploadPart,
    ValidationSchema as signPartSchema,
} from './controllers/sign-upload-part.js';
import {
    Controller as completeMultipartUpload,
    ValidationSchema as completeMultipartSchema,
} from './controllers/complete-multipart-upload.js';
import {
    Controller as abortMultipartUpload,
    ValidationSchema as abortMultipartSchema,
} from './controllers/abort-multipart-upload.js';
import {
    Controller as abortUploadSession,
    ValidationSchema as abortSessionSchema,
} from './controllers/abort-upload-session.js';
import {
    Controller as listParts,
    ValidationSchema as listPartsSchema,
} from './controllers/list-parts.js';
import {
    Controller as listPhotos,
    ValidationSchema as listPhotosSchema,
} from './controllers/list-photos.js';

import {
    Controller as checkDuplicates,
    ValidationSchema as checkDuplicatesSchema,
} from './controllers/check-duplicates.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router
    .route('/uploads/sessions')
    .post(validate(createUploadSessionSchema), withDatabase(createUploadSession));

router
    .route('/uploads/sessions/:sessionId/files')
    .post(validate(createMultipartSchema), withDatabase(createMultipartUpload));

router
    .route('/uploads/sessions/:sessionId/abort')
    .post(validate(abortSessionSchema), withDatabase(abortUploadSession));

router
    .route('/uploads/photos/:photoId/sign-part')
    .post(validate(signPartSchema), withDatabase(signUploadPart));

router
    .route('/uploads/photos/:photoId/complete')
    .post(validate(completeMultipartSchema), withDatabase(completeMultipartUpload));

router
    .route('/uploads/photos/:photoId/abort')
    .post(validate(abortMultipartSchema), withDatabase(abortMultipartUpload));

router
    .route('/uploads/photos/:photoId/parts')
    .get(validate(listPartsSchema), withDatabase(listParts));

router
    .route('/uploads/check-duplicates')
    .post(validate(checkDuplicatesSchema), withDatabase(checkDuplicates));

router.route('/photos').get(validate(listPhotosSchema), withDatabase(listPhotos));

export default router;
