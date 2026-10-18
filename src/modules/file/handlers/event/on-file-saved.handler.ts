import ServerEvent from '@/shared/configs/server-event.js';
import { convertImageToWebp } from '@/modules/file/file.service.js';
import EventHandler from '@/shared/utilities/event-handler.js';
import type { EventContext } from '@/shared/utilities/event-handler.js';
import path from 'path';

const imageFileExtensions = ['.jpg', '.jpeg', '.png'];

export async function Handler(
    ctx: EventContext,
    file: { id: string; key: string; _status: string },
) {
    const isImageToConvert = imageFileExtensions.includes(path.extname(file.key));
    if (isImageToConvert) await convertImageToWebp(ctx.database, { id: file.id });
}

ServerEvent.on('file:saved', EventHandler(Handler, { withDatabase: true }));
