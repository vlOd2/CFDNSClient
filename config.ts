import { CFRecord } from "./cloudflare.ts";
import { arraySatisfiesDescriptor, arraySatisfiesPredicate, Descriptor, satisfiesDescriptor } from "./utils.ts";

export const API_BASE_URL = "https://api.cloudflare.com/client/v4";
export const RECORD_COMMENT = "Record managed automatically by CFDNSClient";

export interface ConfigZone {
    name: string;
    records: string[];
}

export interface Config {
    apiKey: string;
    interval: number;
    zones: ConfigZone[];
}

const ConfigZoneDescriptor: Descriptor<ConfigZone> = {
    name(v) {
        if (typeof v != "string" || !(v = v.trim())) {
            throw new Error("Invalid zone name");
        }
        return v;
    },
    records: arraySatisfiesPredicate((e) => String(e))
};

const ConfigDescriptor: Descriptor<Config> = {
    apiKey(v) {
        if (typeof v != "string" || !(v = v.trim())) {
            throw new Error("Invalid API key");
        }
        return v;
    },
    interval(v) {
        if (typeof v != "number" || !v || isNaN(v) || v < 0) {
            throw new Error("Invalid interval");
        }
        return v;
    },
    zones: arraySatisfiesDescriptor(ConfigZoneDescriptor)
};

let config: Config | undefined = undefined;

export async function readConfig(): Promise<Config> {
    if (!config) {
        config = satisfiesDescriptor(JSON.parse(await Deno.readTextFile("config.json")), ConfigDescriptor);
        if (!config) {
            throw new Error("Config is an empty object");
        }
    }
    return config!;
}

export async function writeDefaultConfig() {
    await Deno.writeTextFile(
        "config.json",
        JSON.stringify(
            {
                apiKey: "",
                interval: 300000, // 5 minutes
                zones: [
                    {
                        name: "example.com",
                        records: ["@", "www", "api"]
                    },
                    {
                        name: "example.net",
                        records: ["@", "www"]
                    }
                ]
            } satisfies Config,
            null,
            4
        )
    );
}

export function mapConfigRecord(zone: ConfigZone, record: string, recordsInfo: CFRecord[]): CFRecord {
    let info;
    if (record == "@") {
        info = recordsInfo.find((r) => r.name == zone.name);
    } else {
        info = recordsInfo.find((r) => r.name.startsWith(`${record}.`));
    }

    if (!info) {
        throw new Error("Could not find record info (does the record exist?)");
    }
    if (info.type != "A") {
        throw new Error(`Unsupported record type: ${info.type} (only A records are supported)`);
    }

    return info;
}
