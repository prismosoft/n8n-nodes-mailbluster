import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MailBlusterApi implements ICredentialType {
	name = 'mailBlusterApi';

	displayName = 'MailBluster API';

	icon: Icon = {
		light: 'file:../icons/mailbluster.svg',
		dark: 'file:../icons/mailbluster.dark.svg',
	};

	documentationUrl = 'https://app.mailbluster.com/api-doc';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key from MailBluster Brand → Settings → API Keys',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.mailbluster.com/api',
			url: '/fields',
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		},
	};
}
