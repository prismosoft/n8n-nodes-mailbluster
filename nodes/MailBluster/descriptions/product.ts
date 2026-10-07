import type { INodeProperties } from 'n8n-workflow';
import { paginationProperties } from './shared';

export const productDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['product'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a product' },
			{ name: 'Delete', value: 'delete', action: 'Delete a product' },
			{ name: 'Get', value: 'get', action: 'Get a product' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many products' },
			{ name: 'Update', value: 'update', action: 'Update a product' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Product ID',
		name: 'productId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['product'],
				operation: ['create', 'get', 'update', 'delete'],
			},
		},
	},
	{
		displayName: 'Product Name',
		name: 'productName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['product'], operation: ['create', 'update'] } },
	},
	...paginationProperties.map((property) => ({
		...property,
		displayOptions: {
			...property.displayOptions,
			show: {
				resource: ['product'],
				operation: ['getAll'],
				...(property.displayOptions?.show ?? {}),
			},
		},
	})),
];
