class ValidationError extends Error {

    details: any;

    constructor(errorMessage: string, details: any) {
        super('Validation Error');
        this.name = 'ValidationError';
        this.message = errorMessage || 'Validation Error';
        this.details = details;
    }
}


export default ValidationError;
