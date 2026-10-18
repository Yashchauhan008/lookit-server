import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import type { EventRow } from '@/modules/events/events.helpers.js';

export type UploadSessionRow = {
    id: string;
    event_id: string;
    purchase_id: string;
    user_id: string;
    reserved_count: number;
    completed_count: number;
    status: string;
    expires_at: string;
};

export type PhotoRow = {
    id: string;
    event_id: string;
    purchase_id: string;
    upload_session_id: string | null;
    orig_key: string | null;
    prev_key: string | null;
    thumb_key: string | null;
    content_hash: string | null;
    width: number | null;
    height: number | null;
    size_bytes: string | number | null;
    taken_at: string | null;
    status: string;
    error: string | null;
    faces_count: number;
    expires_at: string;
    multipart_upload_id: string | null;
    content_type: string | null;
    original_filename: string | null;
    created_at: string;
    updated_at: string | null;
};

export async function requireOwnedEvent(
    db: DatabaseClient,
    eventId: string,
    userId: string,
): Promise<EventRow | null> {
    return db.queryOne<EventRow>(
        `
            SELECT *
            FROM events
            WHERE id = $1
              AND owner_id = $2
              AND status <> 'deleted'
        `,
        [eventId, userId],
    );
}

export function publicPhoto(row: PhotoRow) {
    return {
        id: row.id,
        event_id: row.event_id,
        status: row.status,
        orig_key: row.orig_key,
        prev_key: row.prev_key,
        thumb_key: row.thumb_key,
        content_type: row.content_type,
        original_filename: row.original_filename,
        size_bytes: row.size_bytes == null ? null : Number(row.size_bytes),
        width: row.width,
        height: row.height,
        faces_count: row.faces_count,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
