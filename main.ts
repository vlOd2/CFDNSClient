import { parseArgs } from "@podhmo/with-help";
import { Config, ConfigZone, getNameRecords, readConfig, writeDefaultConfig } from "./config.ts";
import { getZoneID, getZoneRecords, updateRecord } from "./cloudflare.ts";

async function updateZone(apiKey: string, zone: ConfigZone, ipv4?: string, ipv6?: string) {
    console.log("- Fetching zone ID");
    const id = await getZoneID(apiKey, zone);
    console.log("- Zone ID:", id);

    console.log("- Fetching record info");
    const allRecords = await getZoneRecords(apiKey, id);
    console.log("- Zone has", allRecords.length, "known records");
    console.log();

    for (const recordName of zone.records) {
        console.log("- Processing records with name:", recordName);
        try {
            const records = getNameRecords(zone, recordName, allRecords);
            for (const record of records) {
                try {
                    // TODO: make this for each individual record
                    // as a hack, people can duplicate the zone for now
                    if (record.type == "AAAA" && !zone.enableAAAA) {
                        continue;
                    }

                    console.log(" - Record ID:", record.id);
                    console.log(" - Record TTL:", record.ttl);
                    console.log(" - Record type:", record.type);
                    console.log(" - Record content:", record.content);

                    if (record.type == "AAAA" && !ipv6) {
                        throw new Error("Cannot update AAAA record: no valid IPV6 address");
                    } else if (record.type == "A" && !ipv4) {
                        throw new Error("Cannot update A record: no valid IPV4 address");
                    }
                    const expectedContent: string = record.type == "AAAA" ? ipv6! : ipv4!;

                    if (record.content != expectedContent) {
                        console.log(" - Updating record");
                        await updateRecord(apiKey, id, record, expectedContent);
                        console.log(" - Record updated:", expectedContent);
                    } else {
                        console.warn(" - Record is already up to date");
                    }
                } catch (err: any) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error("Failed to process record", record.id, ":", errMsg);
                }
                console.log();
            }
        } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to process records", recordName, ":", errMsg);
        }
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
        console.error("Failed to get public IPV4:", errMsg);
        return undefined;
    }
}

async function getPublicIPV6(): Promise<string | undefined> {
    try {
        console.log("Fetching public IPV6");
        const response = await fetch("https://ipv6.icanhazip.com", {
            cache: "no-store"
        });
        return (await response.text()).trim();
    } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to get public IPV6:", errMsg);
        return undefined;
    }
}

async function updateFromConfig(config: Config) {
    const publicIPv4 = await getPublicIPV4();
    console.log("Public IPv4:", publicIPv4);
    const publicIPv6 = await getPublicIPV6();
    console.log("Public IPv6:", publicIPv6 ?? "*error*");
    console.log();

    for (const zone of config.zones) {
        try {
            console.log("Zone:", zone.name, "Records:", zone.records.length);
            await updateZone(config.apiKey, zone, publicIPv4, publicIPv6);
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
        console.log("IPV4", (await getPublicIPV4()) ?? "*error*");
        console.log("IPV6", (await getPublicIPV6()) ?? "*error*");
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
