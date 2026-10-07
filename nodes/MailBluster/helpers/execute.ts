import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type IHttpRequestMethods,
} from 'n8n-workflow';

import { MailBlusterRateLimiter, mailBlusterApiRequest } from './transport';
import {
	compactObject,
	leadIdentifierToHash,
	parseJsonObject,
	parseJsonValue,
	responseArray,
	responseNextPage,
	tagCollectionToArray,
	type JsonObject,
} from './utils';

function getOrderItems(value: unknown): IDataObject[] | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = (value as { item?: unknown }).item;
	if (!Array.isArray(raw) || raw.length === 0) return undefined;
	return raw.map((item) => item as IDataObject);
}

function asJson(value: unknown): IDataObject {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	return { value };
}

function toItems(values: unknown[], itemIndex: number): INodeExecutionData[] {
	return values.map((value) => ({
		json: asJson(value),
		pairedItem: { item: itemIndex },
	}));
}

async function executeLead(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	let result: unknown;

	if (operation === 'create') {
		const additionalFields = {
			...(this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject),
		};
		const body: JsonObject = {
			email: this.getNodeParameter('email', itemIndex) as string,
			subscribed: this.getNodeParameter('subscribed', itemIndex) as boolean,
			...additionalFields,
		};

		if (additionalFields.fields !== undefined) {
			body.fields = parseJsonObject(additionalFields.fields, 'Custom Fields', this.getNode());
		}
		if (additionalFields.meta !== undefined) {
			body.meta = parseJsonObject(additionalFields.meta, 'Meta', this.getNode());
		}

		const tags = tagCollectionToArray(this.getNodeParameter('tags', itemIndex, {}));
		if (tags) body.tags = tags;

		result = await mailBlusterApiRequest.call(
			this,
			limiter,
			'POST',
			'/leads',
			compactObject(body) as IDataObject,
		);
	} else {
		const identifier = leadIdentifierToHash(
			this.getNodeParameter('leadIdentifier', itemIndex) as string,
		);
		const endpoint = `/leads/${encodeURIComponent(identifier)}`;

		if (operation === 'get') {
			result = await mailBlusterApiRequest.call(this, limiter, 'GET', endpoint);
		} else if (operation === 'delete') {
			result = await mailBlusterApiRequest.call(this, limiter, 'DELETE', endpoint);
			if (result === undefined || result === null || result === '') {
				result = { success: true, leadHash: identifier };
			}
		} else {
			const updateFields = {
				...(this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject),
			};
			if (updateFields.fields !== undefined) {
				updateFields.fields = parseJsonObject(updateFields.fields, 'Custom Fields', this.getNode());
			}
			if (updateFields.meta !== undefined) {
				updateFields.meta = parseJsonObject(updateFields.meta, 'Meta', this.getNode());
			}
			if (updateFields.addTags !== undefined) {
				updateFields.addTags = parseJsonValue(updateFields.addTags, 'Add Tags', this.getNode()) as IDataObject;
			}
			if (updateFields.removeTags !== undefined) {
				updateFields.removeTags = parseJsonValue(
					updateFields.removeTags,
					'Remove Tags',
					this.getNode(),
				) as IDataObject;
			}
			if (Object.keys(updateFields).length === 0) {
				throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
					itemIndex,
				});
			}
			result = await mailBlusterApiRequest.call(
				this,
				limiter,
				'PUT',
				endpoint,
				compactObject(updateFields),
			);
		}
	}

	return toItems([result], itemIndex);
}

async function executeField(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'getAll') {
		const response = await mailBlusterApiRequest.call(this, limiter, 'GET', '/fields');
		return toItems(responseArray(response, 'fields'), itemIndex);
	}

	if (operation === 'create') {
		const result = await mailBlusterApiRequest.call(this, limiter, 'POST', '/fields', {
			fieldLabel: this.getNodeParameter('fieldLabel', itemIndex) as string,
			fieldMergeTag: this.getNodeParameter('fieldMergeTag', itemIndex) as string,
		});
		return toItems([result], itemIndex);
	}

	const fieldId = this.getNodeParameter('fieldId', itemIndex) as number;
	if (operation === 'update') {
		const result = await mailBlusterApiRequest.call(this, limiter, 'PUT', `/fields/${fieldId}`, {
			fieldLabel: this.getNodeParameter('fieldLabel', itemIndex) as string,
			fieldMergeTag: this.getNodeParameter('fieldMergeTag', itemIndex) as string,
		});
		return toItems([result], itemIndex);
	}

	const result = await mailBlusterApiRequest.call(this, limiter, 'DELETE', `/fields/${fieldId}`);
	return toItems(
		[result === undefined || result === null || result === '' ? { success: true, fieldId } : result],
		itemIndex,
	);
}

async function getPaginated(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	endpoint: '/products' | '/orders',
	responseKey: 'products' | 'orders',
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
	const limit = returnAll
		? Number.POSITIVE_INFINITY
		: (this.getNodeParameter('limit', itemIndex) as number);
	let pageNo = this.getNodeParameter('pageNo', itemIndex) as number;
	const records: JsonObject[] = [];

	while (records.length < limit) {
		const response = await mailBlusterApiRequest.call(
			this,
			limiter,
			'GET',
			endpoint,
			undefined,
			{ pageNo },
		);
		records.push(...responseArray(response, responseKey));
		const nextPage = responseNextPage(response);
		if (nextPage === null) break;
		pageNo = nextPage;
	}

	return toItems(records.slice(0, limit), itemIndex);
}

async function executeProduct(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'getAll') {
		return await getPaginated.call(this, limiter, '/products', 'products', itemIndex);
	}

	const productId = this.getNodeParameter('productId', itemIndex) as string;
	const endpoint = `/products/${encodeURIComponent(productId)}`;

	if (operation === 'create') {
		const result = await mailBlusterApiRequest.call(this, limiter, 'POST', '/products', {
			id: productId,
			name: this.getNodeParameter('productName', itemIndex) as string,
		});
		return toItems([result], itemIndex);
	}
	if (operation === 'get') {
		return toItems(
			[await mailBlusterApiRequest.call(this, limiter, 'GET', endpoint)],
			itemIndex,
		);
	}
	if (operation === 'update') {
		const result = await mailBlusterApiRequest.call(this, limiter, 'PUT', endpoint, {
			name: this.getNodeParameter('productName', itemIndex) as string,
		});
		return toItems([result], itemIndex);
	}

	const result = await mailBlusterApiRequest.call(this, limiter, 'DELETE', endpoint);
	return toItems(
		[
			result === undefined || result === null || result === ''
				? { success: true, productId }
				: result,
		],
		itemIndex,
	);
}

async function executeOrder(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'getAll') {
		return await getPaginated.call(this, limiter, '/orders', 'orders', itemIndex);
	}

	const orderId = this.getNodeParameter('orderId', itemIndex) as string;
	const endpoint = `/orders/${encodeURIComponent(orderId)}`;

	if (operation === 'create') {
		const customerOptions = {
			...(this.getNodeParameter('customerOptions', itemIndex, {}) as IDataObject),
		};
		if (customerOptions.fields !== undefined) {
			customerOptions.fields = parseJsonObject(
				customerOptions.fields,
				'Customer Custom Fields',
				this.getNode(),
			) as IDataObject;
		}
		if (customerOptions.meta !== undefined) {
			customerOptions.meta = parseJsonObject(customerOptions.meta, 'Customer Meta', this.getNode()) as IDataObject;
		}
		if (customerOptions.tags !== undefined) {
			customerOptions.tags = parseJsonValue(customerOptions.tags, 'Customer Tags', this.getNode()) as IDataObject;
		}

		const items = getOrderItems(this.getNodeParameter('items', itemIndex, {}));
		if (!items?.length) {
			throw new NodeOperationError(this.getNode(), 'Add at least one order item', { itemIndex });
		}

		const customer = compactObject({
			email: this.getNodeParameter('customerEmail', itemIndex) as string,
			...customerOptions,
		});
		const body = compactObject({
			id: orderId,
			customer,
			currency: (this.getNodeParameter('currency', itemIndex) as string).toUpperCase(),
			totalPrice: this.getNodeParameter('totalPrice', itemIndex) as number,
			items,
			...(this.getNodeParameter('orderOptions', itemIndex, {}) as IDataObject),
		});

		return toItems(
			[
				await mailBlusterApiRequest.call(
					this,
					limiter,
					'POST',
					'/orders',
					body as IDataObject,
				),
			],
			itemIndex,
		);
	}

	if (operation === 'get') {
		return toItems(
			[await mailBlusterApiRequest.call(this, limiter, 'GET', endpoint)],
			itemIndex,
		);
	}
	if (operation === 'delete') {
		const result = await mailBlusterApiRequest.call(this, limiter, 'DELETE', endpoint);
		return toItems(
			[
				result === undefined || result === null || result === ''
					? { success: true, orderId }
					: result,
			],
			itemIndex,
		);
	}

	const updateFields = {
		...(this.getNodeParameter('orderUpdateFields', itemIndex, {}) as IDataObject),
	};
	if (updateFields.customer !== undefined) {
		updateFields.customer = parseJsonObject(updateFields.customer, 'Customer', this.getNode()) as IDataObject;
	}
	if (updateFields.items !== undefined) {
		updateFields.items = parseJsonValue(updateFields.items, 'Items', this.getNode()) as IDataObject;
	}
	if (updateFields.currency) updateFields.currency = String(updateFields.currency).toUpperCase();
	if (Object.keys(updateFields).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field to update', { itemIndex });
	}

	return toItems(
		[
			await mailBlusterApiRequest.call(
				this,
				limiter,
				'PUT',
				endpoint,
				compactObject(updateFields),
			),
		],
		itemIndex,
	);
}

async function executeApi(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const method = this.getNodeParameter('apiMethod', itemIndex) as IHttpRequestMethods;
	const endpoint = this.getNodeParameter('apiEndpoint', itemIndex) as string;
	const query = parseJsonObject(
		this.getNodeParameter('apiQuery', itemIndex, '{}'),
		'Query Parameters',
		this.getNode(),
	);
	const body = ['POST', 'PUT', 'PATCH'].includes(method)
		? parseJsonObject(this.getNodeParameter('apiBody', itemIndex, '{}'), 'Body', this.getNode())
		: undefined;

	const result = await mailBlusterApiRequest.call(
		this,
		limiter,
		method,
		endpoint,
		body as IDataObject | undefined,
		query as IDataObject | undefined,
	);

	return Array.isArray(result) ? toItems(result, itemIndex) : toItems([result], itemIndex);
}

export async function executeMailBlusterOperation(
	this: IExecuteFunctions,
	limiter: MailBlusterRateLimiter,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'lead') return await executeLead.call(this, limiter, operation, itemIndex);
	if (resource === 'field') return await executeField.call(this, limiter, operation, itemIndex);
	if (resource === 'product') return await executeProduct.call(this, limiter, operation, itemIndex);
	if (resource === 'order') return await executeOrder.call(this, limiter, operation, itemIndex);
	if (resource === 'api') return await executeApi.call(this, limiter, itemIndex);

	throw new NodeOperationError(this.getNode(), `Unsupported MailBluster resource: ${resource}`, {
		itemIndex,
	});
}
