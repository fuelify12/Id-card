# Phase 12 — Mobile workflow, responsive layout and camera capture

## Included
- Responsive dashboard shell with collapsible desktop navigation and a mobile navigation toggle.
- Sticky, horizontally scrollable project task links for template, student data, photos, field mapping, generation, validation and ZIP export.
- Touch-friendly controls, visible keyboard focus, reduced-motion support, overflow protection, responsive student-import row cards, and stacked mobile crop previews.
- Optional in-browser camera capture in the existing student-photo upload workspace. Camera permission is requested only after the operator chooses Capture photo; the live preview has a simple head-and-shoulders overlay, front/rear preference switching, retake and explicit confirmation. Confirmed captures enter the existing upload queue and private storage pipeline.
- Camera denial, missing hardware, busy hardware, unsupported APIs and non-secure contexts have actionable fallback messages.
- Existing server-side matching remains unchanged. Camera filenames contain no student serial, so capture order does not silently associate a photo with a student; operator must use the existing explicit assignment/review flow.
- Mobile student import shows compact row cards; desktop keeps its table.
- Crop controls remain accessible via zoom/move buttons and numeric coordinates. Original and processed previews stack on narrow screens.

## Privacy and runtime behavior
- Camera use requires a secure context (HTTPS or localhost) and browser permission.
- No camera frame uploads until the user captures and confirms. Stream tracks are stopped when the dialog closes/unmounts.
- Camera capture uses the actual resolution provided by the browser/device; no resolution guarantee is made.
- Camera captures use the existing upload queue limits and private storage pipeline. This phase does not add resumable chunk uploads; retry is at the existing file-upload queue level.
- Existing generated batch and ZIP export work remains server-side and persisted; mobile polling is not the worker.
- PWA/service-worker caching is intentionally not enabled in this phase. The application contains student photos, records, previews and signed download URLs; introducing a service worker without a carefully audited public-only asset allowlist could cache private data. Static PWA support can be reconsidered separately.

## Validation
- Unit tests cover camera permission/error fallback messaging and secure-context/API support detection.
- CI runs the repository test suite, TypeScript, lint and production build.
- No real Android phone/tablet or browser-device camera session was available in this change. Device-specific permission prompts, front/rear camera selection, camera capture resolution and Android download behavior still require manual verification on target devices.
- Automated tests are not a substitute for visual browser testing at actual viewport sizes. Check representative 360px, 390px, 768px, 1024px and wide desktop widths before production rollout.
