import Transport from 'winston-transport';

export default class FunctionCall extends Transport {
    functionCall: any;

    constructor(opts: any) {
        super(opts);
        this.functionCall = opts.call;
    }

    log(info: any, callback: any) {
        setImmediate(() => {
            this.emit('logged', info);
            this.functionCall(info);
        });

        callback();
    }
}

