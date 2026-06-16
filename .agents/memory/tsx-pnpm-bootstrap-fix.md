---
name: tsx pnpm bootstrap bug
description: pnpm generates tsx/dist/cli.mjs as a shell script but node treats .mjs as ESM, causing SyntaxError. Fix by rewriting cli.mjs to call cli.cjs.
---

## The problem

After `pnpm install`, the tsx binary at `node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs` is actually a **shell script** (not JS), but the `.mjs` extension causes Node to load it as an ES module. This breaks both `pnpm exec tsx` and scripts in packages that list `tsx` as a devDependency.

Error seen: `SyntaxError: Unexpected token 'export'` at `cli.mjs:2`.

## The fix

Overwrite `cli.mjs` with a shell script that calls the real CJS binary:

```sh
printf '#!/bin/sh\nNODE_PATH="<store>/dist/node_modules:<store>/../node_modules:<store>/../../..:/home/runner/workspace/node_modules/.pnpm/node_modules" exec node "<store>/cli.cjs" "$@"\n' \
  > node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs
chmod +x node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs
```

Where `<store>` = `/home/runner/workspace/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist`.

This fix is applied in `scripts/post-merge.sh` after every `pnpm install`.

**Why:** pnpm's binary generation creates a `.mjs`-named shell bootstrap so the OS shebang runs it as a shell script. But node's module resolver checks file extension before shebang, so it fails.

**How to apply:** Run the fix once after `pnpm install`. Also add `"tsx": "catalog:"` to any package's devDependencies that uses `tsx` in its npm scripts (e.g. `lib/db`) so pnpm links the binary locally.
