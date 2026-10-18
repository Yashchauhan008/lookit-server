class ServerError extends Error {

    private details: any;

    constructor( message: string, details?: any) {

        super();
        this.name = 'ServerError';
        this.message = message;
        this.details = details;
    }

    info() {

        return {
            httpStatusCode: 400,
            body: {
                code: 'error',
                message: this.message,
                details: this.details,
            },
        };
    }
}

export default ServerError;
