import SerialPort from "serialport";
import DriverError, { ErrorType } from "./DriverError";
import { EventEmitter } from "stream";
import { CRC } from "crc-full";
import HighsAndLowsParser from "./parsers/HighsAndLowsParser";
import { HighsAndLows } from "./weatherDataInterfaces/HighsAndLows";
import LOOPParser from "./parsers/LOOPParser";
import LOOP2Parser from "./parsers/LOOP2Parser";
import { RealtimeData } from "./weatherDataInterfaces/RealtimeData";

export default class VantageInterface extends EventEmitter {
    private readonly port: SerialPort;
    private readonly crc16 = CRC.default("CRC16_CCIT_ZERO") as CRC;

    constructor(deviceUrl: string) {
        super();
        this.port = new SerialPort(deviceUrl, { baudRate: 19200 });
        this.port.on("error", (err) => this.emit("error", err));
        this.port.on("open", () => this.emit("connection"));
        this.wakeUp();
    }

    /**
     * Splits a buffer received from the console into the acknowledgement byte, the weather data itself and the two crc bytes.
     * @param buffer 
     * @returns 
     */
    private splitCRCAckDataPackage(buffer: Buffer) {
        const bufferCopy = Buffer.alloc(buffer.length - 3);
        buffer.copy(bufferCopy, 0, 1, buffer.length - 2);
        return {
            ack: buffer.readUInt8(0),
            weatherData: bufferCopy,
            crc: buffer.readUInt16BE(buffer.length - 2),
        }
    }

    /**
     * Computes the crc value for the given buffer. Based on the CRC16_CCIT_ZERO standard.
     * @param dataBuffer 
     * @returns the computed crc value (2 byte, 16 bit)
     */
    private computeCRC(dataBuffer: Buffer): number {
        return this.crc16.compute(dataBuffer);
    }

    /**
     * Validates a buffer by computing its crc value and comparing it to the exspected crc value.
     * @param dataBuffer 
     * @param exspectedCRC 
     * @returns whether the buffer is valid
     */
    private validateCRC(dataBuffer: Buffer, exspectedCRC: number): boolean {
        const crc = this.computeCRC(dataBuffer);
        return exspectedCRC === crc;
    }

    /**
     * Wakes up the console. This is necessary in order to send and receive data. The console automatically
     * falls asleep after two minutes of inactivity.
     */
    public async wakeUp(): Promise<void> {
        let succeeded = false;
        let tries = 0;
        do {
            succeeded = await new Promise<boolean>((resolve, reject) => {
                this.port.write("\n", (err) => {
                    if (err) {
                        return resolve(false);
                    }
                    this.port.once("readable", () => {
                        const response = String.raw`${this.port.read()}`;
                        if (response === "\n\r") {
                            this.emit("awakening");
                            return resolve(true);
                        }
                        else return resolve(false);
                    });
                });
            });
            tries++;
        } while (!succeeded && tries <= 3);
        if (!succeeded) throw new DriverError("Failed to wake up console!", ErrorType.CONNECTION);
    }

    /**
     * Validates the connection to the console.
     * @returns whether the connection is valid
     */
    public async validateConnection(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.port.write("TEST\n", (err) => {
                if (err) resolve(false);
                this.port.once("data", (data: Buffer) => {
                    const response = data.toString("utf-8", 2, 6);
                    if (response === "TEST") resolve(true);
                    else resolve(false);
                });
            });
        })
    }

    /**
     * Gets the console's firmware date code.
     * @returns the console's firmware date code
     */
    public async getFirmwareDateCode(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.port.write("VER\n", (err) => {
                if (err) reject(new DriverError("Failed to get firmware date code", ErrorType.FAILED_TO_WRITE));
                this.port.once("data", (data: Buffer) => {
                    const response = data.toString("utf-8");
                    try {
                        const firmwareDateCode = response.split("OK")[1].trim();
                        resolve(firmwareDateCode);
                    } catch (err) {
                        reject(new DriverError("Failed to get firmware date code", ErrorType.INVALID_RESPONSE));
                    }
                });
            });
        })
    }

    /**
     * Gets the console's firmware version. Only works on Vantage Pro 2 or Vantage Vue.
     * @returns the console's firmware version
     */
    public async getFirmwareVersion(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.port.write("NVER\n", (err) => {
                if (err) reject(new DriverError("Failed to get firmware version", ErrorType.FAILED_TO_WRITE));
                this.port.once("data", (data: Buffer) => {
                    const response = data.toString("utf-8");
                    try {
                        const firmwareVersion = response.split("OK")[1].trim();
                        resolve(`v${firmwareVersion}`);
                    } catch (err) {
                        reject(new DriverError("Failed to get firmware version", ErrorType.INVALID_RESPONSE));
                    }
                });
            });
        })
    }

    /**
     * Closes the connection to the console.
     */
    public close(): void {
        this.port.close();
    }

    /**
     * Gets the highs and lows of the recent time from the console.
     * @returns the highs and lows
     */
    public async getHighsAndLows(): Promise<HighsAndLows> {
        return new Promise<any>((resolve, reject) => {
            this.port.write("HILOWS\n", (err) => {
                if (err) reject(new DriverError("Failed to get highs and lows", ErrorType.FAILED_TO_WRITE));
                this.port.once("data", (data: Buffer) => {
                    const splittedData = this.splitCRCAckDataPackage(data);

                    // Check data (crc check)
                    if (!this.validateCRC(splittedData.weatherData, splittedData.crc)) {
                        reject(new DriverError("Received malformed highs and lows", ErrorType.CRC))
                    }

                    // Parse data
                    const parsedWeatherData = new HighsAndLowsParser().parse(splittedData.weatherData);

                    resolve(parsedWeatherData);
                });
            });
        });
    }

    public async getRealtimeData(packageType?: RealtimePackage): Promise<RealtimeData> {
        return new Promise<any>((resolve, reject) => {
            let stringToWrite;
            if (packageType) {
                stringToWrite = "LPS ";
                if (packageType === RealtimePackage.LOOP) stringToWrite += "1 1";
                else if (packageType === RealtimePackage.LOOP2) stringToWrite += "2 1";
                else stringToWrite += "3 2";
                stringToWrite += "\n";
            } else {
                stringToWrite = "LOOP 1\n";
            }
            this.port.write(stringToWrite, (err) => {
                if (err) reject(new DriverError("Failed to get realtime data", ErrorType.FAILED_TO_WRITE));
                this.port.once("data", (data: Buffer) => {
                    const packageType = data.readUInt8(5);
                    if (packageType === 0) {
                        const splittedData = this.splitCRCAckDataPackage(data);

                        // Check data (crc check)
                        if (!this.validateCRC(splittedData.weatherData, splittedData.crc)) {
                            reject(new DriverError("Received malformed realtime data", ErrorType.CRC))
                        }

                        resolve(new LOOPParser().parse(splittedData.weatherData));
                    } else {
                        // LOOP 2 data is 
                        const firstPartOfLOOP2 = data;
                        this.port.once("data", (data: Buffer) => {
                            const dataFull = Buffer.concat([firstPartOfLOOP2, data]);
                            const splittedData = this.splitCRCAckDataPackage(dataFull);

                            // Check data (crc check)
                            if (!this.validateCRC(splittedData.weatherData, splittedData.crc)) {
                                reject(new DriverError("Received malformed realtime data", ErrorType.CRC))
                            }

                            resolve(new LOOP2Parser().parse(splittedData.weatherData));
                        });
                    }
                });
            });

        });
    }
}

export enum RealtimePackage {
    LOOP = "LOOP", LOOP2 = "LOOP2"
}