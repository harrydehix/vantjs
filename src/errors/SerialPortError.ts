import VantError from "./VantError";

/**
 * An error thrown by the underlying [serialport package](https://serialport.io/docs/).
 */
export default class SerialPortError extends VantError {
    constructor(err: Error) {
        super(err.message, "(serialport-error)");
        this.stack = err.stack;
        Error.captureStackTrace(this, this.constructor);
    }
}
