import {
    CreateCollectionCommand,
    DeleteCollectionCommand,
    DeleteFacesCommand,
    IndexFacesCommand,
    ResourceAlreadyExistsException,
    ResourceNotFoundException,
    SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition';
import { collectionIdForEvent, rekognition } from '@/shared/configs/rekognition.js';
import type { FaceEngine, FaceMatch, IndexedFace } from '../face-engine.types.js';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';

export class RekognitionFaceEngine implements FaceEngine {
    constructor(private readonly db: DatabaseClient) {}

    async ensureCollection(eventId: string): Promise<string> {
        const existing = await this.db.queryOne<{ face_collection_id: string | null }>(
            `SELECT face_collection_id FROM events WHERE id = $1`,
            [eventId],
        );
        if (existing?.face_collection_id) return existing.face_collection_id;

        const collectionId = collectionIdForEvent(eventId);
        try {
            await rekognition.send(
                new CreateCollectionCommand({ CollectionId: collectionId }),
            );
        } catch (err) {
            if (!(err instanceof ResourceAlreadyExistsException)) throw err;
        }

        await this.db.query(
            `
                UPDATE events
                SET face_collection_id = $2, updated_at = now()
                WHERE id = $1
            `,
            [eventId, collectionId],
        );
        return collectionId;
    }

    async indexPhoto(
        eventId: string,
        photoId: string,
        imageBytes: Buffer,
    ): Promise<IndexedFace[]> {
        const collectionId = await this.ensureCollection(eventId);

        const result = await rekognition.send(
            new IndexFacesCommand({
                CollectionId: collectionId,
                Image: { Bytes: imageBytes },
                ExternalImageId: photoId,
                MaxFaces: 100,
                QualityFilter: 'AUTO',
                DetectionAttributes: ['DEFAULT'],
            }),
        );

        return (result.FaceRecords || []).map((rec) => {
            const bb = rec.Face?.BoundingBox;
            return {
                externalFaceId: rec.Face?.FaceId || '',
                box:
                    bb &&
                    bb.Left != null &&
                    bb.Top != null &&
                    bb.Width != null &&
                    bb.Height != null
                        ? {
                              left: bb.Left,
                              top: bb.Top,
                              width: bb.Width,
                              height: bb.Height,
                          }
                        : null,
                confidence: rec.Face?.Confidence ?? null,
            };
        }).filter((f) => f.externalFaceId);
    }

    async searchBySelfie(
        eventId: string,
        selfieBytes: Buffer,
        threshold: number,
    ): Promise<FaceMatch[]> {
        const row = await this.db.queryOne<{ face_collection_id: string | null }>(
            `SELECT face_collection_id FROM events WHERE id = $1`,
            [eventId],
        );
        if (!row?.face_collection_id) return [];

        try {
            const result = await rekognition.send(
                new SearchFacesByImageCommand({
                    CollectionId: row.face_collection_id,
                    Image: { Bytes: selfieBytes },
                    FaceMatchThreshold: threshold,
                    MaxFaces: 4096,
                }),
            );

            const matches = result.FaceMatches || [];
            const faceIds = matches
                .map((m) => m.Face?.FaceId)
                .filter((id): id is string => Boolean(id));

            if (!faceIds.length) return [];

            const mapped = await this.db.queryAll<{
                external_face_id: string;
                photo_id: string;
            }>(
                `
                    SELECT external_face_id, photo_id
                    FROM faces
                    WHERE event_id = $1
                      AND external_face_id = ANY($2::text[])
                `,
                [eventId, faceIds],
            );
            const byFace = new Map(mapped.map((r) => [r.external_face_id, r.photo_id]));

            return matches
                .map((m) => {
                    const externalFaceId = m.Face?.FaceId || '';
                    return {
                        externalFaceId,
                        similarity: m.Similarity ?? 0,
                        photoId: byFace.get(externalFaceId) ?? null,
                    };
                })
                .filter((m) => m.externalFaceId);
        } catch (err) {
            if (err instanceof ResourceNotFoundException) return [];
            throw err;
        }
    }

    async deletePhoto(
        eventId: string,
        _photoId: string,
        faceIds: string[],
    ): Promise<void> {
        if (!faceIds.length) return;
        const row = await this.db.queryOne<{ face_collection_id: string | null }>(
            `SELECT face_collection_id FROM events WHERE id = $1`,
            [eventId],
        );
        if (!row?.face_collection_id) return;

        await rekognition.send(
            new DeleteFacesCommand({
                CollectionId: row.face_collection_id,
                FaceIds: faceIds,
            }),
        );
    }

    async deleteEventIndex(eventId: string): Promise<void> {
        const row = await this.db.queryOne<{ face_collection_id: string | null }>(
            `SELECT face_collection_id FROM events WHERE id = $1`,
            [eventId],
        );
        if (!row?.face_collection_id) return;

        try {
            await rekognition.send(
                new DeleteCollectionCommand({
                    CollectionId: row.face_collection_id,
                }),
            );
        } catch (err) {
            if (!(err instanceof ResourceNotFoundException)) throw err;
        }

        await this.db.query(
            `
                UPDATE events
                SET face_collection_id = NULL, updated_at = now()
                WHERE id = $1
            `,
            [eventId],
        );
    }
}
