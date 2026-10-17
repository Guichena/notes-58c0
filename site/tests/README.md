# Independent compatibility regression fixtures

Recommended: run `npm test`. This builds real authored additions, then runs exact original-corpus tests against an isolated temporary `.compat-dist/` built with the same runtime. The real `dist/` stays intact. New authoring additions therefore do not invalidate original-count assertions. The temporary build is removed afterward.

For a corpus with no authoring additions, direct checks after the normal build:

```sh
node --test tests/*.test.mjs
```

The tests use Node's built-in test runner, filesystem, crypto, and VM modules. No external network, browser, package installation, or original-repository checkout is needed at test time. The HTTP-path test starts an ephemeral loopback-only server in the same process.

## Frozen baseline

`fixtures/original-compatibility.json`, `original-routes.json`, `original-images.json`, and `original-route-function.js` were captured directly from upstream revision `a1b8e212f32e23c7a29c1a695bb1255d93ee18a4` before modifying its content. Its original `index.html` has 4,681,405 bytes and SHA-256 `88f78788cd4086948072b6af23df831054c0e849b763c6937c04ee3f65004f4f`.

The capture script rejects any other bytes. It is an explicit review tool, not part of the build or test command:

```sh
node tests/capture-original-fixtures.mjs baseline/index.html
```

Do not regenerate the fixtures from current authored content or build output merely to make a failing test pass. Intentional future content edits should be reviewed separately from this compatibility-only refactor.

## Coverage

- All 524 original entry IDs and their exact order
- SHA-256 of every complete entry; recursively sorted object keys allow harmless JSON field-order changes while arrays and every scalar value remain exact
- Catalog fields, QA counts/marking flags, 63 chunk groups, and all chunk pointers
- The 934 original progress identities, including all 507 zero-based QA questions and legacy `progressKey` overrides
- All original top-level globals, aliases, face-parent mappings, and highlight content
- Every one of the 1,031 original full-text search records, with original record order and query-text normalization
- 1,780 route fixtures covering current IDs, legacy IDs, QA indexes, algorithm aliases, encoded aliases, parent-question migrations, bounds, section anchors, and `must` redirects
- Existing progress reads/writes, v7 migration, inaccessible or corrupt localStorage, and recent-history limits
- The original 31 missing local image references, documented in `reports/missing-image-assets.md`

Search and route baseline capture executes the relevant functions taken directly from the pinned original, without executing the complete DOM application. Runtime tests similarly isolate the production router and storage modules. These are semantic/data compatibility checks; they do not claim browser rendering, accessibility, network-race, screenshot, or loading-performance coverage.
