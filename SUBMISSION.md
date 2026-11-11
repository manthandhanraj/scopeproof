# Devpost submission notes

## ScopeProof

**Turn client-approved work into a PayPal invoice with a clear record of why each charge is included.**

Freelance designers often negotiate extra work in the middle of a conversation. When it's time to bill, an approved change can get missed and a price discussion can be mistaken for approval. ScopeProof compares the signed brief with the client conversation, flags unresolved or cancelled charges, and shows the original messages supporting each proposed line item.

The freelancer selects the charges to include and confirms the sandbox recipient. The app creates a payable PayPal Sandbox invoice and retrieves its ID, buyer link, and current status. In the sample project, the freelancer bills the $300 landing page and approved $75 mobile redesign. The $80 rush charge stays out of the invoice until approved.

**Built with** Gemini 3.1 Flash-Lite for source-linked billing analysis, PayPal Invoicing v2 for sandbox invoice creation and tracking, Node.js, SQLite, HTML, CSS, and JavaScript.

## Demo recording outline

- **0:00–0:20** Show the signed $300 brief and the two proposed extras. Explain how a chat thread can bury the approved work.
- **0:20–1:15** Run Gemini and show $375 billable and $80 excluded. Click **Try cancellation** and show the decisive message and $375 → $300. Restore the original sample for the payment flow.
- **1:15–2:05** Confirm the sandbox buyer, issue the invoice, and show the returned PayPal invoice ID and buyer view.
- **2:05–2:30** Show the verified Sandbox payment and refresh the invoice to display `PAID`. Close on how the freelancer can trace each charge back to an approval.

## Before submitting

- [ ] Confirm each entrant meets the official age, residency, and eligibility rules. If entering as a team, choose an eligible representative and verify all teammates have accepted their Devpost invites.
- [ ] Confirm the project is original and that the team has permission to use all third-party assets and integrations.
- [ ] Run the real Gemini and PayPal Sandbox workflow. Verify it from a clean setup using the same access path judges will receive.
- [ ] Provide a functional hosted build or complete run instructions. Confirm judges can try the live features free of charge through the end of judging on December 15, 2026. Include any necessary test access instructions and keep server secrets out of the public repo.
- [ ] Publish the public source repo with source, assets, the English README, and a detectable open-source license. Keep credentials and SQLite files local.
- [ ] Record the working flow in English or provide an English translation. Use only authorized music and other third-party material. Upload to YouTube as **Public** and keep the video under three minutes.
- [ ] Complete all required Devpost fields in English or provide English translations. Add the description, model and its role, public repository, video link, and the judge testing access path. If seeking a sponsor prize, select the qualifying sponsor tool on the form.
- [ ] Verify public links from a signed-out session and confirm Devpost shows the entry as submitted before November 13, 2026, 1:30 AM IST.

[Official rules](https://paypalaihackathon.devpost.com/rules) · [Organizer updates](https://paypalaihackathon.devpost.com/updates)
