import type { INodeProperties } from 'n8n-workflow';

export const fieldDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['field'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a field' },
			{ name: 'Delete', value: 'delete', action: 'Delete a field' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many fields' },
			{ name: 'Update', value: 'update', action: 'Update a field' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Field Label',
		name: 'fieldLabel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['field'], operation: ['create', 'update'] } },
	},
	{
		displayName: 'Field Merge Tag',
		name: 'fieldMergeTag',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['field'], operation: ['create', 'update'] } },
		description: 'Merge tag used to address the custom field',
	},
	{
		displayName: 'Field ID',
		name: 'fieldId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: { show: { resource: ['field'], operation: ['update', 'delete'] } },
		typeOptions: { minValue: 1, numberStepSize: 1 },
	},
];
