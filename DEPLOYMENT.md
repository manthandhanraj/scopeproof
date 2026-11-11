# Deploy ScopeProof on Render

This repository supports a Render Free Node.js web service with a ScopeProof login page, one-click demo entry, and Supabase email/password accounts. Successfully returned invoice references are signed with a stable server secret and saved in the browser. The app uses these references to retrieve the invoice directly from PayPal even after Render resets the local SQLite cache.

Free services sleep after 15 minutes of inactivity and can take about a minute to wake. Keep the session secret stable through judging so saved references remain valid. Use the same browser, account, and hosted URL to recover its saved invoice. A request from before a service restart is rejected so it cannot automatically create another draft after the local cache is lost. If an invoice response was interrupted, check the PayPal Sandbox dashboard before starting another invoice.

## Create the service

1. Publish the source to a public GitHub repository. Exclude `.env` and all SQLite files. Include `render.yaml`, the source, README, and MIT license.
2. Sign into Render. Select **New → Web Service** and connect that repository. Choose the Node runtime and the **Free** instance type. Set the build command to `npm test` and the start command to `npm start`. Leave the root directory empty.
3. Add `NODE_VERSION=24.18.1`, `NODE_ENV=production`, `HOST=0.0.0.0`, and `GEMINI_MODEL=gemini-3.1-flash-lite` in environment settings. No disk is required. `render.yaml` also describes this Free configuration if using a Blueprint.
4. Add `GEMINI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_SANDBOX_BUYER`. Copy their values from your local `.env` into Render's private environment settings.
5. Set `SESSION_SECRET` to a random secret of at least 16 characters. This signs secure session cookies and invoice references. Existing deployments can continue using their `DEMO_PASSWORD` value as the internal secret. To rename it, copy the exact value into `SESSION_SECRET` before removing the old variable. Visitors use the login page's **Try demo** button without entering credentials.
6. For real accounts, create a Supabase project and add its Project URL as `SUPABASE_URL` and its Publishable or legacy anon key as `SUPABASE_ANON_KEY` in Render. These two values enable **Create account** and **Sign in**. Accounts are stored by Supabase and survive Render restarts. The demo works while account setup is pending.
7. In Supabase Authentication settings, enable email/password sign-in and set the Site URL to the hosted app URL. Choose whether new users must confirm their email. With confirmation enabled, configure the email delivery needed for your test users. For immediate hackathon test-account access, you can turn email confirmation off. The app handles both modes.
8. Set the health check path to `/health`. Deploy the web service and wait for a successful deployment. Copy its HTTPS `onrender.com` address.

## Verify the hosted demo

1. Open `/health` at the hosted address and verify the result is `{"status":"ok"}`.
2. Open the base address in an Incognito window. Verify the ScopeProof login page appears. Click **Try demo** and verify the workspace opens with sample text preloaded.
3. Analyze the sample. Expect $375 billable and $80 excluded. Click **Try cancellation** and expect $300 billable. Also test **Sign out**, **Create account**, and **Sign in** after configuring Supabase.
4. Restore and analyze the sample, issue one sandbox invoice, and verify its buyer link. Complete the sandbox payment and refresh the invoice status.
5. Reload the page and verify the same invoice status is recovered. Restart the Render service and refresh again to verify the signed reference still retrieves that invoice from PayPal.

## Supply access to judges

Put the HTTPS demo URL, instructions to click **Try demo**, and the US Personal Sandbox buyer sign-in instructions in the submission's judge testing instructions. Judges can also create an account after Supabase is configured. Keep provider secrets in Render's environment settings. State that payments use PayPal Sandbox test funds. Confirm the judge can access the app and Sandbox checkout before submitting.

Keep the hosted service, credentials, Gemini access, and any funding or credits available through December 15, 2026. Deployment remains pending until the Render service and the signed-out judge walkthrough are verified.

## Render references

- [Persistent disks](https://render.com/docs/disks)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Environment variables](https://render.com/docs/configure-environment-variables)
