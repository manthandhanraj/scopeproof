# Deploy ScopeProof on Render

This repository supports a Render Free Node.js web service with a password-protected judge demo. Successfully returned invoice references are signed with the stable demo password and saved in the browser. The app uses these references to retrieve the invoice directly from PayPal even after Render resets the local SQLite cache.

Free services sleep after 15 minutes of inactivity and can take about a minute to wake. Keep the demo password stable through judging so saved references remain valid. Use the same browser and hosted URL to recover its saved invoice. A request from before a service restart is rejected so it cannot automatically create another draft after the local cache is lost. If an invoice response was interrupted, check the PayPal Sandbox dashboard before starting another invoice.

## Create the service

1. Publish the source to a public GitHub repository. Exclude `.env` and all SQLite files. Include `render.yaml`, the source, README, and MIT license.
2. Sign into Render. Select **New → Web Service** and connect that repository. Choose the Node runtime and the **Free** instance type. Set the build command to `npm test` and the start command to `npm start`. Leave the root directory empty.
3. Add `NODE_VERSION=24.18.1`, `NODE_ENV=production`, `HOST=0.0.0.0`, and `GEMINI_MODEL=gemini-3.1-flash-lite` in environment settings. No disk is required. `render.yaml` also describes this Free configuration if using a Blueprint.
4. Add `GEMINI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_SANDBOX_BUYER`. Copy their values from your local `.env` into Render's private environment settings.
5. Choose `DEMO_USERNAME` and a unique `DEMO_PASSWORD` of at least 16 characters. Use these only for the judge demo. The app requires them on Render and presents a browser sign-in prompt.
6. Set the health check path to `/health`. Deploy the web service and wait for a successful deployment. Copy its HTTPS `onrender.com` address.

## Verify the hosted demo

1. Open `/health` at the hosted address and verify the result is `{"status":"ok"}`.
2. Open the base address in an Incognito window. Verify it requests the judge username and password.
3. Sign in and run the sample. Expect $375 billable and $80 excluded. Click **Try cancellation** and expect $300 billable.
4. Restore and analyze the sample, issue one sandbox invoice, and verify its buyer link. Complete the sandbox payment and refresh the invoice status.
5. Reload the page and verify the same invoice status is recovered. Restart the Render service and refresh again to verify the signed reference still retrieves that invoice from PayPal.

## Supply access to judges

Put the HTTPS demo URL, judge username and password, and the US Personal Sandbox buyer sign-in instructions in the submission's judge testing instructions. Keep provider secrets in Render's environment settings. State that payments use PayPal Sandbox test funds. Confirm the judge can access the app and Sandbox checkout before submitting.

Keep the hosted service, credentials, Gemini access, and any funding or credits available through December 15, 2026. Deployment remains pending until the Render service and the signed-out judge walkthrough are verified.

## Render references

- [Persistent disks](https://render.com/docs/disks)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Environment variables](https://render.com/docs/configure-environment-variables)
