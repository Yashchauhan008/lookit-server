import { createClient } from 'redis';
import env from '@/shared/configs/env.js';

const redisClient = createClient({
    url: env.REDIS_URL,
});


export default redisClient;
