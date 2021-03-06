/**
 * Super class of all errors explicitly thrown by vantjs.
 */
export default class VantError extends Error {
    /**
     * @hidden
     * @param msg
     * @param errorType
     */
    constructor(msg: string, errorType?: string) {
        if (errorType) msg = `${msg} ${errorType}`;
        super(msg);
        Error.captureStackTrace(this, this.constructor);
    }
}
