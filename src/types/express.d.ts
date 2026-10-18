declare global {
    namespace Express {
        interface Request {
            validatedQuery?: any;
            id?: string;
            user?: {
                id: string;
                email: string;
                name: string;
                role: 'photographer' | 'admin';
                status: 'active' | 'suspended';
                studio_name: string | null;
            };
        }
    }
}

export {};
