# Verification — 24 October 2026

- Six automated tests pass: file validation, size limits, model preprocessing, alpha mask normalization, safe filenames, and independent ZIP parsing.
- Syntax, internal links, vendored runtime assets, and model SHA-256 checks pass.
- Real model inference ran successfully in the browser. A transparent PNG was downloaded and independently inspected: 1200 × 800, RGBA, transparent corner.
- A square white-background PNG was downloaded and independently inspected: 1080 × 1080, opaque white corner.
- Multiple images processed sequentially; unsupported input displayed a clear error.
- ZIP creation was independently tested with the actual downloaded PNGs; both entries decoded correctly and CRC validation passed. The local HTTP browser did not complete a ZIP save, so a visible Save ZIP link is provided. A final HTTPS browser ZIP-save test is outstanding.
- Desktop and 390 px responsive layouts were visually checked. This is not equivalent to testing a physical iPhone or Android device.
- The private deployment succeeded. The separate cloud browser encountered the expected sign-in gate, so hosted end-to-end testing requires owner sign-in.

The GitHub application tree matches the deployed application tree. GitHub and Sites have different commit IDs because the GitHub connector was used after CLI authentication failed. Documentation and this screenshot were added after publication; they do not alter the hosted app.
