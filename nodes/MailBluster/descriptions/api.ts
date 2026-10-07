import type { INodeProperties } from 'n8n-workflow';

export const apiDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['api'] } },
		options: [{ name: 'Make Request', value: 'request', action: 'Make a custom API request' }],
		default: 'request',
	},
	{
		displayName: 'Method',
		name: 'apiMethod',
		type: 'options',
		options: [
			{ name: 'DELETE', value: 'DELETE' },
			{ name: 'GET', value: 'GET' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
		],
		default: 'GET',
		displayOptions: { show: { resource: ['api'], operation: ['request'] } },
	},
	{
		displayName: 'Endpoint',
		name: 'apiEndpoint',
		type: 'string',
		default: '',
		required: true,
		placeholder: '/products',
		description: 'Path relative to https://api.mailbluster.com/api',
		displayOptions: { show: { resource: ['api'], operation: ['request'] } },
	},
	{
		displayName: 'Query Parameters (JSON)',
		name: 'apiQuery',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['api'], operation: ['request'] } },
	},
	{
		displayName: 'Body (JSON)',
		name: 'apiBody',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['api'],
				operation: ['request'],
				apiMethod: ['POST', 'PUT', 'PATCH'],
			},
		},
	},
];
