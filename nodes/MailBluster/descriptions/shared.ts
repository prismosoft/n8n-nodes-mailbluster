import type { INodeProperties } from 'n8n-workflow';

export const leadTagsProperty: INodeProperties = {
	displayName: 'Tags',
	name: 'tags',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
		multipleValueButtonText: 'Add Tag',
	},
	default: {},
	options: [
		{
			name: 'tag',
			displayName: 'Tag',
			values: [
				{
					displayName: 'Value',
					name: 'value',
					type: 'string',
					default: '',
				},
			],
		},
	],
};

export const orderItemsProperty: INodeProperties = {
	displayName: 'Items',
	name: 'items',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
		multipleValueButtonText: 'Add Item',
	},
	default: {},
	options: [
		{
			name: 'item',
			displayName: 'Item',
			values: [
				{
					displayName: 'Product ID',
					name: 'id',
					type: 'string',
					default: '',
					required: true,
				},
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
					required: true,
				},
				{
					displayName: 'Price',
					name: 'price',
					type: 'number',
					default: 0,
					required: true,
					typeOptions: { minValue: 0 },
				},
				{
					displayName: 'Quantity',
					name: 'quantity',
					type: 'number',
					default: 1,
					required: true,
					typeOptions: { minValue: 1, numberStepSize: 1 },
				},
			],
		},
	],
};

export const paginationProperties: INodeProperties[] = [
	{
		displayName: 'Start Page',
		name: 'pageNo',
		type: 'number',
		default: 1,
		typeOptions: { minValue: 1, numberStepSize: 1 },
		description: 'MailBluster page number to start reading from',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results from the start page onward',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 1000, numberStepSize: 1 },
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				returnAll: [false],
			},
		},
	},
];
