
export enum Type {
    UINT8 = 1,
    UINT16_LE = 2,
    UINT16_BE = 3,
    UINT16 = UINT16_LE,
    UINT32_LE = 4,
    UINT32_BE = 5,
    UINT32 = UINT32_LE,
    INT8 = 6,
    INT16_LE = 7,
    INT16_BE = 8,
    INT16 = INT16_LE,
    INT32_LE = 9,
    INT32_BE = 10,
    INT32 = INT32_LE,
}

type PropertyConfig = {
    type: Type,
    position: number,
    nullables?: number[] | string,
    transform?: ((val: number) => any) | string,
    dependsOn?: string,
}

interface ParsingStructure {
    [propertyName: string]: ParsingStructure | [ParsingStructure, number] | PropertyConfig
}
interface ParsedObject {
    [propertyName: string]: any | ParsedObject;
}

export default class BinaryParser {
    private struct: ParsingStructure;
    private offset: number;
    private transformers: Array<[string, (val: number) => any]> = [];
    private nullables: Array<[string, number[]]> = [];

    constructor(struct: ParsingStructure, offset = 0) {
        this.struct = struct;
        this.offset = offset;
    }

    public setTransformer(name: string, transformer: (val: number) => any): void {
        this.transformers.push([name, transformer]);
    }

    private getTransformer(name: string) {
        for (let i = 0; i < this.transformers.length; i++) {
            const tName = this.transformers[i][0];
            if (tName === name) return this.transformers[i][1];
        }
    }

    public setNullables(name: string, nullables: number[]) {
        this.nullables.push([name, nullables]);
    }

    private getNullables(name: string) {
        for (let i = 0; i < this.nullables.length; i++) {
            const nName = this.nullables[i][0];
            if (nName === name) return this.nullables[i][1];
        }
    }

    public parse(buffer: Buffer): ParsedObject {
        return this.parseRecursivly(buffer, this.struct);
    }

    public byteLength(type: Type): number {
        switch (type) {
            case Type.INT8:
            case Type.UINT8:
                return 1;
            case Type.INT16_BE:
            case Type.INT16_LE:
            case Type.UINT16_BE:
            case Type.UINT16_LE:
                return 2;
            case Type.UINT32_BE:
            case Type.UINT32_LE:
            case Type.INT32_BE:
            case Type.INT32_LE:
                return 4;
        }
    }

    private parseRecursivly(buffer: Buffer, struct: ParsingStructure, arrayIndex = 0): ParsedObject {
        let result: ParsedObject = {};

        const propertyKeys = Object.keys(struct);
        for (let i = 0; i < propertyKeys.length; i++) {
            const propertyKey = propertyKeys[i];
            const propertyValue = struct[propertyKey];
            let resolvedValue = undefined;

            if (this.isPropertyConfig(propertyValue)) {
                const propertyConfig = propertyValue as PropertyConfig;

                // OLD FASHION
                /*if (propertyConfig.dependsOn) {
                    // if the dependency has not been parsed until now...
                    if (result[propertyConfig.dependsOn] === undefined) {
                        // if the dependency cannot be found in the current layer, throw an exception
                        if (!propertyKeys.includes(propertyConfig.dependsOn)) throw new Error("Invalid parse structure. Property is dependend on unknown property.")
                        // if the dependency was found in the current layer, move the dependend property to the end of the property list
                        propertyKeys.push(propertyKey);
                        continue;
                        // if the dependency has already been parsed
                    } else {
                        // if the dependency is null, set the property to null to
                        if (result[propertyConfig.dependsOn] === null) resolvedValue = null;
                    }
                }*/
                if (resolvedValue === undefined) {
                    let position = propertyConfig.position;
                    if (arrayIndex) position += this.byteLength(propertyConfig.type) * arrayIndex;
                    resolvedValue = this.read(buffer, propertyConfig.type, position);
                    if (propertyConfig.nullables && resolvedValue !== null) {
                        if (typeof propertyConfig.nullables === "string") {
                            const nullables = this.getNullables(propertyConfig.nullables);
                            if (nullables) resolvedValue = this.nullNullables(resolvedValue, nullables);
                            else throw new Error(`Invalid nullables name '${propertyConfig.nullables}!`);
                        }
                        else resolvedValue = this.nullNullables(resolvedValue, propertyConfig.nullables);
                    }
                    if (propertyConfig.transform && resolvedValue !== null) {
                        if (typeof propertyConfig.transform === "string") {
                            const transformer = this.getTransformer(propertyConfig.transform);
                            if (transformer) resolvedValue = transformer(resolvedValue);
                            else throw new Error(`Invalid transformer name '${propertyConfig.transform}!`);
                        }
                        else resolvedValue = propertyConfig.transform(resolvedValue);
                    }
                    if (propertyConfig.dependsOn && resolvedValue !== null) {
                        resolvedValue = { value: resolvedValue, dependsOn: propertyConfig.dependsOn };
                    }
                }
            } else if (propertyValue instanceof Array) {
                const length = propertyValue[1];
                const structure = propertyValue[0];

                resolvedValue = [];
                for (let a = 0; a < length; a++) {
                    const parsedEntry = this.parseRecursivly(buffer, structure, a);
                    resolvedValue.push(parsedEntry);
                }
            } else {
                const nestedStruct = propertyValue as ParsingStructure;
                resolvedValue = this.parseRecursivly(buffer, nestedStruct, arrayIndex);
            }

            result[propertyKey] = resolvedValue;
        }
        result = this.resolveDependencies(result);
        return result;
    }

    private nullNullables(value: number, nullables: number[]) {
        if (value === null) return null;
        for (let i = 0; i < nullables.length; i++) {
            if (value === nullables[i]) return null;
        }
        return value;
    }

    private resolveDependencies(data: ParsedObject): ParsedObject {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let value: any = data[key];
            if (this.isDependencyObject(value)) {
                type DependencyObject = { value: any, dependsOn: string };
                const dependencyObject = value as DependencyObject;
                // Check dependency's value
                if (!keys.includes(dependencyObject.dependsOn)) throw new Error("Invalid parse structure. Property is dependend on unknown property.");
                const dependency = data[dependencyObject.dependsOn];
                const valueOfDependency = this.isDependencyObject(dependency) ? (dependency as DependencyObject).value : dependency;
                if (valueOfDependency === null) value = null;
                else value = dependencyObject.value;
            } else if (value instanceof Array) {
                for (let i = 0; i < value.length; i++) {
                    value[i] = this.resolveDependencies(value[i]);
                }
            } else if (value !== null && typeof value === "object") {
                value = this.resolveDependencies(value);
            }
            data[key] = value;
        }
        return data;
    }

    private isDependencyObject(value: any) {
        return value !== null && typeof value === "object" && value.dependsOn !== undefined && value.dependsOn !== null;
    }

    private read(buffer: Buffer, type: Type, position: number): number | null {
        position += this.offset;
        let result: number | null = null;
        switch (type) {
            case Type.INT8:
                // console.log(`Reading INT8 at ${position}`)
                result = buffer.readInt8(position); break;
            case Type.INT16_BE:
                // console.log(`Reading INT16_BE at ${position}`)
                result = buffer.readInt16BE(position); break;
            case Type.INT16_LE:
                // console.log(`Reading INT16_LE at ${position}`)
                result = buffer.readInt16LE(position); break;
            case Type.INT32_BE:
                // console.log(`Reading INT32_BE at ${position}`)
                result = buffer.readInt32BE(position); break;
            case Type.INT32_LE:
                // console.log(`Reading INT32_LE at ${position}`)
                result = buffer.readInt32LE(position); break;
            case Type.UINT8:
                // console.log(`Reading UINT8 at ${position}`)
                result = buffer.readUInt8(position); break;
            case Type.UINT16_BE:
                // console.log(`Reading UINT16_BE at ${position}`)
                result = buffer.readUInt16BE(position); break;
            case Type.UINT16_LE:
                // console.log(`Reading UINT16_LE at ${position}`)
                result = buffer.readUInt16LE(position); break;
            case Type.UINT32_BE:
                // console.log(`Reading UINT32_BE at ${position}`)
                result = buffer.readUInt32BE(position); break;
            case Type.UINT32_LE:
                // console.log(`Reading UINT32_LE at ${position}`)
                result = buffer.readUInt32LE(position); break;
        }
        if (result === undefined) result = null;
        return result;
    }

    private isPropertyConfig(object: any): boolean {
        return object.type && true;
    }
}

// const buffer = Buffer.alloc(64);
// buffer.writeInt16LE(12);
// buffer.writeInt16LE(24, 2);
// buffer.writeInt16LE(0, 4);
// buffer.writeInt16LE(0, 6);
// buffer.writeInt16LE(1112, 8);

// buffer.writeInt8(3, 10);
// buffer.writeInt8(1, 11);
// buffer.writeInt8(-23, 12);
// buffer.writeInt8(-1, 13);
// buffer.writeInt8(2, 14);

// const parser = new BinaryParser({
//     temps: [{
//         test: {
//             low: {
//                 type: Type.INT16,
//                 position: 0,
//                 nullables: [0],
//                 dependsOn: "high"
//             },
//             high: {
//                 type: Type.INT8,
//                 position: 10,
//                 dependsOn: "low",
//                 nullables: [-1]
//             }
//         }
//     }, 5],
// });

// import inspect from "./inspect";
// inspect(parser.parse(buffer))