import { createHash } from 'node:crypto';

export type JsonObject = Record<string, unknown>;

export function leadIdentifierToHash(identifier: string): string {
	const value = identifier.trim();
	if (!value.includes('@')) return value;
	return createHash('md5').update(value).digest('hex');
}

export function parseJsonObject(value: unknown, parameterName: string): JsonObject | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
	if (typeof value !== 'string') {
		throw new Error(`${parameterName} must be a JSON object`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error(`${parameterName} must contain valid JSON`);
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${parameterName} must be a JSON object`);
	}
	return parsed as JsonObject;
}

export function parseJsonValue(value: unknown, parameterName: string): unknown {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(`${parameterName} must contain valid JSON`);
	}
}

export function tagCollectionToArray(value: unknown): string[] | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = (value as { tag?: unknown }).tag;
	if (!Array.isArray(raw)) return undefined;
	const tags = raw
		.map((entry) => {
			if (typeof entry === 'string') return entry.trim();
			if (entry && typeof entry === 'object' && 'value' in entry) {
				return String((entry as { value: unknown }).value).trim();
			}
			return '';
		})
		.filter(Boolean);
	return tags.length ? tags : undefined;
}

export function compactObject<T extends JsonObject>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
	) as T;
}

export function responseArray(response: unknown, key: string): JsonObject[] {
	if (!response || typeof response !== 'object') return [];
	const value = (response as Record<string, unknown>)[key];
	return Array.isArray(value) ? (value as JsonObject[]) : [];
}

export function responseNextPage(response: unknown): number | null {
	if (!response || typeof response !== 'object') return null;
	const meta = (response as Record<string, unknown>).meta;
	if (!meta || typeof meta !== 'object') return null;
	const nextPageNo = (meta as Record<string, unknown>).nextPageNo;
	return typeof nextPageNo === 'number' ? nextPageNo : null;
}
