export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
export const MAX_FILES_PER_SESSION = 500;
export const UPLOAD_SESSION_TTL_HOURS = 6;
export const PART_URL_EXPIRES_SECONDS = 3600;
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024;

export const ACCEPTED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

export const EXT_BY_CONTENT_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
};

export function normalizeContentType(raw: string): string {
    const ct = raw.trim().toLowerCase().split(';')[0]!;
    if (ct === 'image/jpg') return 'image/jpeg';
    return ct;
}

export function extensionFor(contentType: string, filename?: string): string {
    const fromType = EXT_BY_CONTENT_TYPE[normalizeContentType(contentType)];
    if (fromType) return fromType;
    const match = filename?.match(/\.([a-z0-9]+)$/i);
    if (match) {
        const ext = match[1]!.toLowerCase();
        if (ext === 'jpeg') return 'jpg';
        if (ext === 'jpg' || ext === 'png') return ext;
    }
    return 'jpg';
}
