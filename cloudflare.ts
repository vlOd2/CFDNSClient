import { ConfigZone, RECORD_COMMENT } from "./config.ts";
import { handleResponseAndState, buildGetRequest, buildPostRequest } from "./request.ts";

export interface CFError {
    code: number;
    message: string;
}

export interface CFMessage {
    code: number;
    message: string;
}

export interface CFResponse {
    errors: CFError[];
    messages: CFMessage[];
    success: boolean;
}

export interface CFZone {
    name: string;
    id: string;
}

export interface CFListZonesResponse extends CFResponse {
    result: CFZone[];
}

export interface CFRecord {
    id: string;
    name: string;
    type: string;
    ttl: number;
    content?: string;
    comment?: string;
    proxied?: boolean;
}

export interface CFListRecordsResponse extends CFResponse {
    result: CFRecord[];
}

export async function getZoneID(apiKey: string, zone: ConfigZone): Promise<string> {
    return (
        await handleResponseAndState<CFListZonesResponse>(
            buildGetRequest(`/zones?match=${encodeURIComponent(zone.name)}`, apiKey)
        )
    ).result[0].id;
}

export async function getZoneRecords(apiKey: string, zoneID: string): Promise<CFRecord[]> {
    return (
        await handleResponseAndState<CFListRecordsResponse>(
            buildGetRequest(`/zones/${encodeURIComponent(zoneID)}/dns_records`, apiKey)
        )
    ).result;
}

export async function updateRecord(apiKey: string, zoneID: string, record: CFRecord, content: string): Promise<void> {
    await handleResponseAndState<CFResponse>(
        buildPostRequest(
            `/zones/${encodeURIComponent(zoneID)}/dns_records/${encodeURIComponent(record.id)}`,
            apiKey,
            "PATCH",
            {
                type: record.type,
                name: record.name,
                ttl: record.ttl,
                content,
                comment: RECORD_COMMENT
            }
        )
    );
}
