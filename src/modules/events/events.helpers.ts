export function slugifyBase(input: string): string {
    const base = input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);

    return base || 'event';
}

export function randomSuffix(length = 6): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

export type EventRow = {
    id: string;
    owner_id: string;
    slug: string;
    name: string;
    description: string | null;
    event_date: string | null;
    visibility: 'selfie_only' | 'full_gallery';
    pin_hash: string | null;
    theme: Record<string, unknown>;
    cover_desktop_key: string | null;
    cover_mobile_key: string | null;
    face_collection_id: string | null;
    status: 'active' | 'hidden' | 'deleted';
    created_at: string;
    updated_at: string | null;
    photo_count?: string | number;
};

export function publicEvent(row: EventRow) {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        event_date: row.event_date,
        visibility: row.visibility,
        theme: row.theme ?? {},
        cover_desktop_key: row.cover_desktop_key,
        cover_mobile_key: row.cover_mobile_key,
        status: row.status,
        has_pin: Boolean(row.pin_hash),
        created_at: row.created_at,
        updated_at: row.updated_at,
        photo_count: Number(row.photo_count ?? 0),
    };
}
