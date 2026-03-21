import { parseArgs } from "@podhmo/with-help";
import { Config, ConfigZone, mapConfigRecord, readConfig, writeDefaultConfig } from "./config.ts";
import { getZoneID, getZoneRecordsInfo, updateRecord } from "./cloudflare.ts";

async function updateZone(apiKey: string, zone: ConfigZone, recordContent: string) {
    console.log("- Fetching zone ID");
    const id = await getZoneID(apiKey, zone);
    console.log("- Zone ID:", id);

    console.log("- Fetching record info");
    const recordsInfo = await getZoneRecordsInfo(apiKey, id);
    console.log("- Zone has", recordsInfo.length, "known records");
    console.log();

    for (const record of zone.records) {
        console.log("- Processing record:", record);
        try {
            const info = mapConfigRecord(zone, record, recordsInfo);
            console.log(" - Record ID:", info.id);
            console.log(" - Record TTL:", info.ttl);
            console.log(" - Record type:", info.type);
            console.log(" - Record content:", info.content);

            if (info.content != recordContent) {
                console.log(" - Updating record");
                await updateRecord(apiKey, id, info, recordContent);
                console.log(" - Record updated:", recordContent);
            } else {
                console.warn(" - Record is already up to date");
            }
        } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to process record:", record, errMsg);
        }
        console.log();
    }
}

async function getPublicIPV4(): Promise<string | undefined> {
    try {
        console.log("Fetching public IPV4");
        const response = await fetch("https://ipv4.icanhazip.com", {
            cache: "no-store"
        });
        return (await response.text()).trim();
    } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to get public IP:", errMsg);
        return undefined;
    }
}

async function updateFromConfig(config: Config) {
    const publicIP = await getPublicIPV4();
    if (!publicIP) {
        return;
    }
    console.log("Public IP:", publicIP);

    for (const zone of config.zones) {
        try {
            console.log("Zone:", zone.name, "Records:", zone.records.length);
            await updateZone(config.apiKey, zone, publicIP);
            console.log("Finished processing zone");
            console.log();
        } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to process zone:", zone.name, errMsg);
        }
    }
}

async function main() {
    const args = parseArgs(Deno.args, {
        name: "CFDNSClient",
        description: "manages Cloudflare DNS records",
        boolean: ["display-ip", "display-config", "only-once", "write-config"]
    });

    if (args["display-ip"]) {
        console.log((await getPublicIPV4()) ?? "*error*");
        return;
    }

    if (args["write-config"]) {
        await writeDefaultConfig();
        return;
    }

    // all options below here depend on the config
    let config: Config;
    try {
        config = await readConfig();
    } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to read config:", errMsg);
        return;
    }

    if (args["display-config"]) {
        console.log(config);
        return;
    }

    if (args["only-once"]) {
        await updateFromConfig(config);
        return;
    }

    const loop = async () => {
        await updateFromConfig(config);
        console.log("Waiting for", config.interval, "ms");
        setTimeout(loop, config.interval);
    };
    loop();

    Deno.addSignalListener("SIGINT", () => {
        console.log("Exiting...");
        Deno.exit();
    });
}

await main();
