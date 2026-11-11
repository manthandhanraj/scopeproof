# ScopeProof

ScopeProof helps freelance designers turn agreed work and approved scope changes into a reviewable PayPal invoice. Gemini reads a signed brief and a chronological client conversation, identifies billable items, and points to the source messages behind each decision. The freelancer reviews the charges and recipient before issuing a sandbox invoice.

## Run locally

1. Install Node.js 24 or newer. There are no external packages to install.
2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS and Linux).
3. Set `GEMINI_API_KEY` using [Google AI Studio](https://aistudio.google.com/apikey). The default model is `gemini-3.1-flash-lite`. Set `GEMINI_MODEL` to a Gemini model your project can access that supports structured outputs with `generateContent`.
4. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), select **Sandbox** and open your merchant REST app under **Apps & Credentials**. In its **Features** section, enable **Invoicing** and save before starting the app. Copy the client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Under Sandbox Accounts, obtain a personal test buyer's email and set `PAYPAL_SANDBOX_BUYER`. The buyer password is only needed when signing in to PayPal Sandbox to pay.
5. Run `npm.cmd start` in Windows PowerShell, or `npm start` on macOS and Linux. Open `http://127.0.0.1:4173` in your browser.

The server listens on loopback. This prototype is intended for local testing with test credentials and synthetic inputs. Gemini receives the text you submit for analysis. SQLite stores the request fingerprint and PayPal invoice ID for repeat-request handling. Keep `.env` and the generated SQLite file out of the public repository.

For the USD demo, use a United States Business sandbox account for the REST app and a United States Personal sandbox account as the buyer. Check that the invoice's **Bill to** address matches the Personal test account before paying.

## Judge walkthrough

1. Click **Try demo** on the login page. The sample is preloaded. Click **Analyze billing evidence**. You can also use **Load sample** to restore it later.
2. Verify **Billable now** is $375 and **Excluded** is $80. Open the redesign's **Decision timeline** to trace the proposed charge and the client's approval.
3. Click **Try cancellation**. ScopeProof appends a follow-up message and analyzes it. The redesign is marked **Cancelled**, the decisive message is highlighted, and the review shows $375 → $300. Click **Load sample** and analyze again to restore the original scenario before issuing the $375 invoice.
4. Check the recipient, confirm the reviewed charges, and click **Issue PayPal invoice**. The app creates a draft, makes it payable without emailing anyone, then retrieves the invoice ID, state, and sandbox buyer link from PayPal.
5. Open the buyer invoice and sign in using the sandbox personal account. After the sandbox payment, return and click **Refresh status** to read the updated state from PayPal.

## Verified review cases

Live tests used Gemini 3.1 Flash-Lite with synthetic client messages.

| Case | Expected result | Observed result |
| --- | --- | --- |
| Signed $300 scope and explicitly approved $75 redesign | Both charges included | $375 billable |
| Client asks about an $80 rush quote and defers the decision | Pending and excluded | $80 excluded |
| Client later cancels the $75 redesign | Cancelled, with the revocation cited | $300 billable |
| Client approves work but has not resolved competing $75 and $95 quotes | Needs review with no billable redesign amount | $300 billable |

For the conflict example, use the same signed brief and replace the conversation with these two lines:

```text
Designer: The redesign quote lists $75 USD, but my follow-up lists $95 USD. Which price do you approve?
Client: Go ahead with the redesign. I will confirm which of those prices applies tomorrow.
```

If Gemini or PayPal rejects credentials, check `.env`, the model available to your account, and the app's Sandbox settings. Restart the app after making changes. If invoice creation was interrupted before an ID came back, look for the invoice in the sandbox business dashboard before starting a new one. The existing request will refuse to create a second draft when the first outcome is uncertain.

## Integrations

- **Gemini API** produces structured proposals with line references. The server checks reference indices and uses the original text to display each citation. An approved amount must match a dollar amount in the cited evidence. Missing approval references, unclear prices, and amount mismatches hold the charge for review.
- **PayPal Invoicing v2** creates, sends, and retrieves sandbox invoices. The server only sends user-selected charges after confirmation. Payments take place on PayPal's hosted sandbox invoice page.
- **Node.js and SQLite** serve the interface and keep the same request from creating duplicate drafts.

Run `npm.cmd test` in Windows PowerShell, or `npm test` on macOS and Linux, for local checks with simulated API responses. A live sandbox run requires your own keys and sandbox buyer account.

## Fresh setup verification

Run `npm.cmd run verify` on Windows, or `npm run verify` on macOS and Linux. The verifier creates a fresh temporary copy of the public source files, runs its local tests, starts the copied application on an available loopback port, and checks the actual HTTP routes. It verifies that `.env`, the invoice database, and server source cannot be downloaded through the app.

To also verify the configured live Gemini reviews and read-only PayPal Sandbox access, run `npm.cmd run verify -- --live` on Windows, or `npm run verify -- --live` on macOS and Linux. Credentials are inherited from your local environment and are not copied into the temporary source folder. This command does not create invoices or initiate payments.

The browser remembers the last invoice reference separately for each account on the same origin and retrieves its current state from PayPal after a page reload. Local SQLite retains request history when its filesystem persists. Hosted demos additionally sign successful invoice references using the session secret and account identity. These browser references still work after Render Free resets its local filesystem, provided the session secret remains the same.

## Accounts

The login page includes **Try demo**, **Sign in**, and **Create account**. Demo entry uses a signed HttpOnly session cookie and preloads the sample. Real accounts use Supabase Auth. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to enable signup and sign-in. Email confirmation follows your Supabase settings. Passwords are sent directly from this server to Supabase over HTTPS and are not stored in the local invoice database or browser storage. Account sessions expire after 12 hours. See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration and testing instructions.

## Access for judges

For a local build, follow **Run locally** and **Judge walkthrough**. Live features require a usable Gemini API key and a PayPal Sandbox business app with Invoicing enabled. A supplied private demo access path, if included in the submission, should let judges use these features without provisioning their own API account. Keep that access and its provider credits active through December 15, 2026.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render Blueprint and hosted judge access setup. A live deployment URL and its testing instructions must be supplied in the Devpost submission. Deployment and the hosted judge walkthrough remain pending.
