import { CFResponse } from "./cloudflare.ts";
import { API_BASE_URL } from "./config.ts";

export async function handleResponse<T extends CFResponse>(promise: Promise<Response>): Promise<T> {
    const response = await promise;
    if (!response.ok) {
        throw new Error(`Response code does not indicate success: ${response.status}`);
    }
    return (await response.json()) as T;
}

export function buildGetRequest(endpoint: string, apiKey: string): Promise<Response> {
    return fetch(`${API_BASE_URL}${endpoint}`, {
        method: "GET",
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
}

export function buildPostRequest(endpoint: string, apiKey: string, method: string, data: any): Promise<Response> {
    return fetch(`${API_BASE_URL}${endpoint}`, {
        method: method,
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
}

export async function handleResponseAndState<T extends CFResponse>(promise: Promise<Response>): Promise<T> {
    const response = await handleResponse<T>(promise);
    if (!response.success) {
        for (const err of response.errors) {
            console.error("[Cloudflare Error] ", err.code, ":", err.message);
        }
        throw new Error("Cloudflare error");
    }
    if (response.messages.length > 0) {
        for (const msg of response.messages) {
            console.warn("[Cloudflare Message] ", msg.code, ":", msg.message);
        }
    }
    return response;
}
