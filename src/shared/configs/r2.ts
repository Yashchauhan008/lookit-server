/**
 * @deprecated Import from `@/shared/configs/media-storage.js`.
 * Kept so existing upload controllers keep working while provider is s3|r2.
 */
export {
    isMediaStorageConfigured as isR2Configured,
    mediaS3 as r2,
    MEDIA_BUCKET as R2_BUCKET,
    MEDIA_PUBLIC_BASE_URL as R2_PUBLIC_BASE_URL,
    publicObjectUrl,
    mediaStorageNotConfiguredMessage,
} from './media-storage.js';
