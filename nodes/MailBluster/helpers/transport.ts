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
	}
	return undefined;
}

function getRetryAfterMilliseconds(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;
	const response = (error as Record<string, unknown>).response;
	if (!response || typeof response !== 'object') return undefined;
	const headers = (response as Record<string, unknown>).headers;
	if (!headers || typeof headers !== 'object') return undefined;
	const raw = (headers as Record<string, unknown>)['retry-after'];
	if (typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) * 1000;
	if (typeof raw === 'number') return raw * 1000;
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
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	};

	if (body && Object.keys(body).length) options.body = body;
	if (qs && Object.keys(qs).length) options.qs = qs;

	for (let attempt = 0; attempt < 4; attempt++) {
		await limiter.wait();
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, 'mailBlusterApi', options);
		} catch (error) {
			const statusCode = getStatusCode(error);
			const shouldRetry =
				statusCode !== undefined &&
				RETRYABLE_STATUS_CODES.has(statusCode) &&
				attempt < 3;

			if (!shouldRetry) {
				throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
			}

			const retryAfter = getRetryAfterMilliseconds(error);
			await sleep(retryAfter ?? 1_000 * 2 ** attempt);
		}
	}

	throw new NodeOperationError(this.getNode(), 'MailBluster request failed after retries');
}
