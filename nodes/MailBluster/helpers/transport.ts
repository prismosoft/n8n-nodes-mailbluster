import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';

const BASE_URL = 'https://api.mailbluster.com/api';
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRY_DELAY_MS = 120_000;

function getStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;
	const candidate = error as Record<string, unknown>;
	for (const key of ['httpCode', 'statusCode', 'status']) {
		const value = candidate[key];
		if (typeof value === 'number') return value;
		if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
	}
	const response = candidate.response;
	if (response && typeof response === 'object') {
		const responseStatus = (response as Record<string, unknown>).statusCode;
		if (typeof responseStatus === 'number') return responseStatus;
const status = (response as Record<string, unknown>).status;
if (typeof status === 'number') return status;
	}
	return undefined;
}

function getRetryAfterHeader(error: unknown): unknown {
// n8n wraps Axios errors in NodeApiError. Read the original response through
// cause (or errorResponse for plain-object errors), without serializing errors:
// serialization can discard headers and expose request credentials.
const pending: unknown[] = [error];
const seen = new Set<object>();
while (pending.length && seen.size < 16) {
const current = pending.shift();
if (!current || typeof current !== 'object' || seen.has(current)) continue;
seen.add(current);
const candidate = current as Record<string, unknown>;
const response = candidate.response;
if (response && typeof response === 'object') {
const headers = (response as Record<string, unknown>).headers;
if (headers && typeof headers === 'object') {
const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'retry-after');
if (entry) return entry[1];
}
}
pending.push(candidate.cause, candidate.errorResponse);
}
return undefined;
}

function getRetryAfterMilliseconds(error: unknown): number | undefined {
const raw = getRetryAfterHeader(error);
if (typeof raw === 'number' && raw >= 0) return raw * 1000;
if (typeof raw === 'string') {
const value = raw.trim();
if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(value)) {
const timestamp = Date.parse(value);
if (Number.isFinite(timestamp)) return Math.max(0, timestamp - Date.now());
}
}
	return undefined;
}

/**
 * Per-execution limiter matching MailBluster's documented limits:
 * 10 requests/second and 100 requests/minute.
 * Concurrent workflows can still share the same account-level allowance.
 */
export class MailBlusterRateLimiter {
	private readonly timestamps: number[] = [];

	async wait(): Promise<void> {
		while (true) {
			const now = Date.now();
			while (this.timestamps.length && now - this.timestamps[0] >= 60_000) {
				this.timestamps.shift();
			}

			const lastSecond = this.timestamps.filter((timestamp) => now - timestamp < 1_000);
			const minuteWait =
				this.timestamps.length >= 100 ? Math.max(0, 60_000 - (now - this.timestamps[0])) : 0;
			const secondWait =
				lastSecond.length >= 10 ? Math.max(0, 1_000 - (now - lastSecond[0])) : 0;
			const waitFor = Math.max(minuteWait, secondWait);

			if (waitFor <= 0) {
				this.timestamps.push(Date.now());
				return;
			}
			await sleep(waitFor + 20);
		}
	}
}

export async function mailBlusterApiRequest(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${normalizedEndpoint}`,
		json: true,
timeout: REQUEST_TIMEOUT_MS,
// Read HTTP failures as full responses before n8n can wrap them and discard
// their headers (older NodeApiError versions do not preserve Error causes).
returnFullResponse: true,
ignoreHttpStatusErrors: true,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	};

	if (body && Object.keys(body).length) options.body = body;
	if (qs && Object.keys(qs).length) options.qs = qs;

// A failed write may already have been applied. Never automatically repeat it.
const maxAttempts = method === 'GET' ? 4 : 1;
for (let attempt = 0; attempt < maxAttempts; attempt++) {
		await limiter.wait();
		try {
const response = await this.helpers.httpRequestWithAuthentication.call(
this, 'mailBlusterApi', options,
);
if (response.statusCode >= 400) {
throw new NodeApiError(this.getNode(), {
statusCode: response.statusCode,
response: { status: response.statusCode, headers: response.headers, data: response.body },
});
}
return response.body;
		} catch (error) {
			const statusCode = getStatusCode(error);
			const shouldRetry =
				statusCode !== undefined &&
				RETRYABLE_STATUS_CODES.has(statusCode) &&
attempt < maxAttempts - 1;

			if (!shouldRetry) {
				throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
			}

			const retryAfter = getRetryAfterMilliseconds(error);
const delay = retryAfter ?? 1_000 * 2 ** attempt;
// Do not retry earlier than the server requested, or wait without a bound.
if (!Number.isFinite(delay) || delay > MAX_RETRY_DELAY_MS) {
throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
}
await sleep(delay);
		}
	}

	throw new NodeOperationError(this.getNode(), 'MailBluster request failed after retries');
}
