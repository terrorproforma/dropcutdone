# Browser API for agents

The browser exposes `window.dropcutdone` after `/app.js` loads. Only operate on photos the user authorizes. Images do not leave the browser. These methods share the same queue and limits as the visible UI.

```js
await window.dropcutdone.addFiles([file]); // File objects, resolves after validation/queueing
window.dropcutdone.getState(); // [{id,name,status,message,width,height}]
await window.dropcutdone.setOptions({background:'white',size:'square'});
const png = await window.dropcutdone.exportResult(id); // Blob; requires completed cutout
window.dropcutdone.clear(); // cancels processing and removes local working copies
await window.dropcutdone.loadSample(); // queues the bundled sample
```

`background`: `transparent` or `white`. `size`: `original`, `square`, or `portrait`.
`status`: `queued`, `processing`, `done`, or `error`.

Observe `dropcutdone:accepted`, `dropcutdone:processed`, `dropcutdone:download`, and `dropcutdone:error` events on `window` for local workflow integration. They contain counts or stages, never image pixels. They are not stored or sent anywhere. Add a first-party aggregate analytics endpoint and privacy review before using them to measure acquisition across users.

This API does not provide unattended HTTP inference, payment operations, refunds, or email. A later server API needs authentication, quotas, idempotency, cost limits, and a model-serving deployment. Keep payment and support automation separate from the public browser client; never embed admin keys in `dist/`.
