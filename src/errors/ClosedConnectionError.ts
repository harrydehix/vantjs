import VantError from "./VantError";

export default class ClosedConnectionError extends VantError {
    constructor(msg?: string) {
        super(
            msg === undefined
                ? "Serial connection to weather station is closed"
                : msg,
            "(closed-connection-error)"
        );
        Error.captureStackTrace(this, this.constructor);
    }
}
