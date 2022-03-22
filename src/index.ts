export { default as VantInterface } from "./interfaces/VantInterface";
export { default as VantVueInterface } from "./interfaces/VantVueInterface";
export { default as VantProInterface } from "./interfaces/VantProInterface";
export { default as VantPro2Interface } from "./interfaces/VantPro2Interface";
export { LoopPackage, LoopPackageType } from "./structures/LOOP";

export { default as RichRealtimeDataContainer } from "./dataContainers/RichRealtimeDataContainer";
export { DeviceModel as DeviceModel } from "./dataContainers/RichRealtimeDataContainer";

export { default as VantError } from "./errors/VantError";
export { default as ClosedConnectionError } from "./errors/ClosedConnectionError";
export { default as FailedToSendCommandError } from "./errors/FailedToSendCommandError";
export { default as MalformedDataError } from "./errors/MalformedDataError";
export { default as ParserError } from "./errors/ParserError";
export { default as SerialConnectionError } from "./errors/SerialConnectionError";
export { default as DeviceStillConnectedError } from "./errors/DeviceStillConnectedError";
export { default as UnsupportedDeviceModelError } from "./errors/UnsupportedDeviceModelError";
export { default as MissingDevicePathError } from "./errors/MissingDevicePathError";

export { default as inspect } from "./util/inspect";
