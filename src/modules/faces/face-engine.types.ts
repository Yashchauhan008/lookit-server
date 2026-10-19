export type IndexedFace = {
    externalFaceId: string;
    box: {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null;
    confidence: number | null;
};

export type FaceMatch = {
    externalFaceId: string;
    similarity: number;
    photoId: string | null;
};

export interface FaceEngine {
    ensureCollection(eventId: string): Promise<string>;
    indexPhoto(
        eventId: string,
        photoId: string,
        imageBytes: Buffer,
    ): Promise<IndexedFace[]>;
    searchBySelfie(
        eventId: string,
        selfieBytes: Buffer,
        threshold: number,
    ): Promise<FaceMatch[]>;
    deletePhoto(eventId: string, photoId: string, faceIds: string[]): Promise<void>;
    deleteEventIndex(eventId: string): Promise<void>;
}
