import env from '@/shared/configs/env.js';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import type { FaceEngine } from './face-engine.types.js';
import { RekognitionFaceEngine } from './engines/rekognition.engine.js';

export function createFaceEngine(db: DatabaseClient): FaceEngine {
    if (env.FACE_ENGINE === 'self_hosted') {
        throw new Error('Self-hosted face engine is Phase 3 — use FACE_ENGINE=rekognition');
    }
    return new RekognitionFaceEngine(db);
}
