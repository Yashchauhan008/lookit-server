import multer from 'multer';
import fs from 'fs';
import { v7 as uuidv7 } from 'uuid';
import path from 'path';

const uploadDirectory = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase().slice(1);
        const UUID = uuidv7();
        cb(null, `${UUID}.${extension}`);
    },
});

export default storage;
