import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import { Controller as uploadFile } from '@/modules/file/controllers/upload-file.js';
import { Controller as uploadMultipleFiles } from '@/modules/file/controllers/upload-multiple-files.js';
import env from '@/shared/configs/env.js';
import express from 'express';
import fileUpload from '@/shared/middlewares/multer/file-upload.js';

const router = Router();

router.route('/upload').post(fileUpload.single('file'), withDatabase(uploadFile));

router.route('/upload-multiple').post(fileUpload.array('files'), withDatabase(uploadMultipleFiles));

router.use('/', express.static(env.FILE_STORAGE_PATH));

export default router;
