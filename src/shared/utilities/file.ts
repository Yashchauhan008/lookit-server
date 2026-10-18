import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import env from '@/shared/configs/env.js';
import ServerError from '@/shared/utilities/server-error.class.js';
import sharp from 'sharp';

const fileStoragePath = env.FILE_STORAGE_PATH;

if (!fs.existsSync(fileStoragePath)) fs.mkdirSync(fileStoragePath, { recursive: true });

export const upload = async (filePath: string, newFileKey: string = '') => {
    const isFileExists = fs.existsSync(filePath);
    if (!isFileExists) throw new ServerError('File not found');
    const fileKey = path.join(newFileKey, path.basename(filePath));
    if (!fs.existsSync(path.join(env.FILE_STORAGE_PATH, newFileKey)))
        fs.mkdirSync(path.join(env.FILE_STORAGE_PATH, newFileKey), { recursive: true });
    await fsp.copyFile(filePath, path.join(env.FILE_STORAGE_PATH, fileKey));
    await fsp.unlink(filePath);
    return fileKey;
};

export const deleteFile = async (fileKey: string) => {
    const filePath = path.join(env.FILE_STORAGE_PATH, fileKey);
    if (!fs.existsSync(filePath)) return;
    await fsp.unlink(filePath);
};

export async function convertToWebp(fileKey: string) {
    if (fileKey.endsWith('.webp')) return fileKey;
    const filePath = path.join(env.FILE_STORAGE_PATH, fileKey);
    const outputFileKey = path.basename(fileKey, path.extname(fileKey)) + '.webp';
    const outputFilePath = path.join(env.FILE_STORAGE_PATH, outputFileKey);
    if (!fs.existsSync(filePath)) throw new ServerError('File not found');
    await sharp(filePath).webp({ quality: 100 }).toFile(outputFilePath);
    return outputFileKey;
}

/**
 * Get all file keys from the file storage
 * @param dir - The directory to search for files
 * @param files - The array to store the file keys
 * @returns The array of file keys
 */
export async function getAllFileKeys(dir: string = env.FILE_STORAGE_PATH, files = []) {
    const entries = await fsp.readdir(dir, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
        if (entry.isFile()) {
            files.push(path.join(dir, entry.name).replace(env.FILE_STORAGE_PATH + '/', ''));
        }

        if (entry.isDirectory()) {
            await getAllFileKeys(path.join(env.FILE_STORAGE_PATH, entry.name), files);
        }
    }

    return files;
}
