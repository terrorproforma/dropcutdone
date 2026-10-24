# Working on DropCutDone

- `dist/` is the deployable, buildless app. Keep the browser client free of credentials.
- Read README.md and docs/launch.md before changing product claims or adding billing.
- Preserve local image processing and no-upload privacy unless the user authorizes an explicit product change.
- Every button must work; do not mock successful processing, checkout, or downloads.
- Run `npm test` and `npm run check` after behavior changes. Use a real browser for inference/export changes and inspect a downloaded PNG.
- Preserve the GitHub origin and the existing Sites project ID. A private preview is not a public launch.
- Follow upstream commercial license requirements. Verify model SHA-256 after any weight change.
- Do not start outreach, ad spend, subscriptions, or change payment accounts without the user's authorization.
