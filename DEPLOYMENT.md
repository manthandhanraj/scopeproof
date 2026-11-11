# Deploy ScopeProof on Render

This repository includes a Render Blueprint in `render.yaml`. It creates one Node.js web service with a 1 GB persistent disk for SQLite invoice references and a password-protected judge demo. The Blueprint selects Render's paid Starter instance. Review the price shown by Render before creating the service. Persistent disks require a paid instance. Use any eligible hackathon credits available to your account.

## Create the service

1. Publish the source to a public GitHub repository. Exclude `.env` and all SQLite files. Include `render.yaml`, the source, README, and MIT license.
2. Sign into Render. Select **New → Blueprint** and connect that repository.
3. Review the `scopeproof` service, its Starter plan, and its 1 GB persistent disk.
4. Enter the requested environment variables. Copy the Gemini and PayPal Sandbox values from your local `.env` into Render's private environment settings.
5. Choose `DEMO_USERNAME` and a unique `DEMO_PASSWORD` of at least 16 characters. Use these only for the judge demo. The app requires them on Render and presents a browser sign-in prompt.
6. Create the Blueprint and wait for the service to report a successful deployment. Copy its HTTPS `onrender.com` address.

## Verify the hosted demo

1. Open `/health` at the hosted address and verify the result is `{"status":"ok"}`.
2. Open the base address in an Incognito window. Verify it requests the judge username and password.
3. Sign in and run the sample. Expect $375 billable and $80 excluded. Click **Try cancellation** and expect $300 billable.
4. Restore and analyze the sample, issue one sandbox invoice, and verify its buyer link. Complete the sandbox payment and refresh the invoice status.
5. Reload the page and verify the same invoice status is recovered. Restart the Render service and refresh again to verify the invoice data survived on the persistent disk.

## Supply access to judges

Put the HTTPS demo URL, judge username and password, and the US Personal Sandbox buyer sign-in instructions in the submission's judge testing instructions. Keep provider secrets in Render's environment settings. State that payments use PayPal Sandbox test funds. Confirm the judge can access the app and Sandbox checkout before submitting.

Keep the hosted service, credentials, Gemini access, and any funding or credits available through December 15, 2026. Deployment remains pending until the Render service and the signed-out judge walkthrough are verified.

## Render references

- [Persistent disks](https://render.com/docs/disks)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Environment variables](https://render.com/docs/configure-environment-variables)
