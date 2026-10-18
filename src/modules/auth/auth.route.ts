import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import { requireAuth } from '@/shared/middlewares/require-auth.js';

import {
    Controller as registerUser,
    ValidationSchema as registerUserValidationSchema,
} from '@/modules/auth/controllers/register-user.js';
import {
    Controller as verifyRegistration,
    ValidationSchema as verifyRegistrationValidationSchema,
} from '@/modules/auth/controllers/verify-registration.js';
import {
    Controller as loginUser,
    ValidationSchema as loginUserValidationSchema,
} from '@/modules/auth/controllers/login-user.js';
import { Controller as getMe } from '@/modules/auth/controllers/get-me.js';

const router = Router();

router.route('/register').post(validate(registerUserValidationSchema), withDatabase(registerUser));

router
    .route('/verify-registration')
    .post(validate(verifyRegistrationValidationSchema), withDatabase(verifyRegistration));

router.route('/login').post(validate(loginUserValidationSchema), withDatabase(loginUser));

router.route('/me').get(requireAuth, getMe);

export default router;
