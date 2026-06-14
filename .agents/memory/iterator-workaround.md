---
name: Iterator workaround for filter(Boolean).map destructure
description: TypeScript 5.x rejects array destructuring in .map() callbacks after .filter(Boolean).
---

TypeScript refuses: `].filter(Boolean).map(([label, val]) => …)`
Error: `Type '(string | number)[] | null' must have a '[Symbol.iterator]()' method`.

**Fix:**
```ts
].filter(Boolean).map((row) => {
  const [label, val] = row as [string, number];
  return ( … );
})
```

**Why:** After `.filter(Boolean)` the type becomes `(T | null | undefined)[]`; TypeScript can't prove each element is iterable for destructuring, but an explicit `as` cast in the body satisfies it.
