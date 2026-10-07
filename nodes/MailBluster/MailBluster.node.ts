import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import { apiDescription } from './descriptions/api';
import { fieldDescription } from './descriptions/field';
import { leadDescription } from './descriptions/lead';
import { orderDescription } from './descriptions/order';
import { productDescription } from './descriptions/product';
import { executeMailBlusterOperation } from './helpers/execute';
import { MailBlusterRateLimiter } from './helpers/transport';

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	try {
		return JSON.stringify(error);
	} catch {
		return 'Unknown MailBluster error';
	}
}

export class MailBluster implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MailBluster',
		name: 'mailBluster',
		icon: {
			light: 'file:../../icons/mailbluster.svg',
			dark: 'file:../../icons/mailbluster.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage MailBluster leads, fields, products, and orders',
		defaults: {
			name: 'MailBluster',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mailBlusterApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Custom API Call', value: 'api' },
					{ name: 'Field', value: 'field' },
					{ name: 'Lead', value: 'lead' },
					{ name: 'Order', value: 'order' },
					{ name: 'Product', value: 'product' },
				],
				default: 'lead',
			},
			...leadDescription,
			...fieldDescription,
			...productDescription,
			...orderDescription,
			...apiDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputItems = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const limiter = new MailBlusterRateLimiter();

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				returnData.push(
					...(await executeMailBlusterOperation.call(
						this,
						limiter,
						resource,
						operation,
						itemIndex,
					)),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: errorMessage(error) },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
				throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
