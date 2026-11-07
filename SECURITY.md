# Security

## Report a vulnerability

Email `security@edgaze.ai`. Do not open a public issue.

Include the affected version, steps to reproduce, impact, and a contact.

## Using the SDK safely

- Keep your API key on your server. The SDK refuses to run in a browser unless you pass `dangerouslyAllowBrowser: true`.
- Verify every webhook with `unwrapWebhook` on the raw request body before acting on it, and keep the default five-minute tolerance.
- Store keys and webhook secrets in environment variables or a secrets manager, never in source control.
