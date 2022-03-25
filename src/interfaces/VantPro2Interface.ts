import merge from "lodash.merge";
import MalformedDataError from "../errors/MalformedDataError";
import LOOP2Parser from "../parsers/LOOP2Parser";
import LOOP1Parser from "../parsers/LOOP1Parser";
import RichRealtimeData from "../structures/RichRealtimeData";
import VantInterface from "./VantInterface";
import UnsupportedDeviceModelError from "../errors/UnsupportedDeviceModelError";
import { LOOP1, LOOP2 } from "../structures";
import { RichRainData } from "../structures/subtypes";
import { MinimumVantInterfaceSettings } from "./settings/MinimumVantInterfaceSettings";

/**
 * Interface to the _Vantage Pro 2_ weather station. Is built on top of the {@link VantInterface}.
 *
 * Offers station dependent features like {@link VantPro2Interface.getRichRealtimeData}, {@link VantPro2Interface.getLOOP1}, {@link VantPro2Interface.getLOOP2}, {@link VantPro2Interface.isSupportingLOOP2Packages} and {@link VantPro2Interface.getFirmwareVersion}.
 */
export default class VantPro2Interface extends VantInterface {
    /**
     * Creates an interface to your vantage pro 2 weather station using the passed settings. The device should be connected
     * serially.
     *
     * @example
     * ```typescript
     * const device = await VantPro2Interface.create({ path: "COM3", rainCollectorSize: "0.2mm" });
     *
     * const richRealtimeData = await device.getRichRealtimeData();
     * inspect(richRealtimeData);
     *
     * await device.close();
     * ```
     * @param settings the settings
     */
    public static async create(settings: MinimumVantInterfaceSettings) {
        const device = new VantPro2Interface(settings);

        await this.performOnCreateAction(device);

        return device;
    }

    /**
     * Checks whether the connected weather station is supporting {@link LOOP2} packages. This is done using the firmware's date code.
     * @returns whether the connected weather station is supporting {@link LOOP2} packages
     */
    public async isSupportingLOOP2Packages(): Promise<boolean> {
        const firmwareDateCode = await this.getFirmwareDateCode();
        return Date.parse(firmwareDateCode) > Date.parse("Apr 24 2002");
    }

    /**
     * Gets the console's firmware version in the `"vX.XX"` format (e.g. `"v3.80"`).
     * @returns the console's firmware version
     */
    public async getFirmwareVersion() {
        this.checkPortConnection();
        const data = await this.writeAndWaitForBuffer("NVER\n");
        try {
            const firmwareVersion = data
                .toString("utf-8")
                .split("OK")[1]
                .trim();
            return `v${firmwareVersion}`;
        } catch (err) {
            throw new MalformedDataError();
        }
    }

    /**
     * Gets the {@link LOOP1} package.
     * @returns the {@link LOOP1} package
     */
    public async getLOOP1() {
        this.checkPortConnection();
        const data = await this.writeAndWaitForBuffer("LPS 1 1\n");

        // Check ack
        this.validateAcknowledgementByte(data);

        const packageType = data.readUInt8(5);
        if (packageType === 0) {
            const splittedData = this.splitCRCAckDataPackage(data);

            // Check data (crc check)
            this.validateCRC(splittedData.weatherData, splittedData.crc);

            return new LOOP1Parser(
                this.rainClicksToInchTransformer,
                this.unitTransformers
            ).parse(splittedData.weatherData);
        } else {
            throw new UnsupportedDeviceModelError(
                "This weather station doesn't support explicitly querying LOOP (version 1) packages. Try getLOOP2() or getDefaultLOOP()."
            );
        }
    }

    /**
     * Gets the {@link LOOP2} package. Requires firmware dated after April 24, 2002 (v1.90 or above).
     * To check if your weather station supports the {@link LOOP2} package call {@link isSupportingLOOP2Packages}.
     * @returns the {@link LOOP2} package
     */
    public async getLOOP2() {
        this.checkPortConnection();
        const data = await this.writeAndWaitForBuffer("LPS 2 1\n");

        // Check ack
        this.validateAcknowledgementByte(data);

        const packageType = data.readUInt8(5);
        if (packageType !== 0) {
            // LOOP 2 data is splitted (only tested on vantage pro 2)
            const firstPartOfLOOP2 = data;

            const secondPartOfLOOP2 = await this.waitForBuffer();

            const dataFull = Buffer.concat([
                firstPartOfLOOP2,
                secondPartOfLOOP2,
            ]);

            const splittedData = this.splitCRCAckDataPackage(dataFull);

            // Check data (crc check)
            this.validateCRC(splittedData.weatherData, splittedData.crc);

            return new LOOP2Parser(
                this.rainClicksToInchTransformer,
                this.unitTransformers
            ).parse(splittedData.weatherData);
        } else {
            throw new UnsupportedDeviceModelError(
                "This weather station doesn't support LOOP2 packages. Try getLOOP() or getDefaultLOOP()."
            );
        }
    }

    /**
     * Gets detailed weather information from all sensors (internally combining {@link LOOP1} and {@link LOOP2} packages).
     * Only works if your weather station supports {@link LOOP2} packages. This can be checked by calling {@link isSupportingLOOP2Packages}.
     * @returns detailed weather information
     */
    public async getRichRealtimeData(): Promise<RichRealtimeData> {
        this.checkPortConnection();
        const richRealtimeRecord: RichRealtimeData = new RichRealtimeData();

        const loop1Package = (await this.getLOOP1()) as Partial<LOOP1>;
        const rain1Data = loop1Package.rain;

        delete loop1Package["alarms"];
        delete loop1Package["packageType"];
        delete loop1Package["nextArchiveRecord"];
        delete loop1Package["rain"];

        const loop2Package = (await this.getLOOP2()) as Partial<LOOP2>;
        const rain2Data = loop2Package.rain;

        delete loop2Package["et"];
        delete loop2Package["packageType"];
        delete loop2Package["graphPointers"];
        delete loop2Package["humidity"];
        delete loop2Package["temperature"];
        delete loop2Package["rain"];

        merge(richRealtimeRecord, loop1Package);
        merge(richRealtimeRecord, loop2Package);

        richRealtimeRecord.rain = merge(
            new RichRainData(),
            rain1Data,
            rain2Data
        );

        return richRealtimeRecord;
    }
}
