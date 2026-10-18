import { Router } from 'express';
import authRoutes from '@/modules/auth/auth.route.js';
import fileRoutes from '@/modules/file/file.route.js';
import eventsRoutes from '@/modules/events/events.route.js';
import publicEventsRoutes from '@/modules/events/public-events.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/files', fileRoutes);
router.use('/events', eventsRoutes);
router.use('/e', publicEventsRoutes);

export default router;
