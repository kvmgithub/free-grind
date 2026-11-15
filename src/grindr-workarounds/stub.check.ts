// Compile-time check only (never imported): stub.ts offers everything index.ts
// does, with compatible types, so swapping it in can't break a call site.
import type * as Workarounds from "./index";
import * as Stub from "./stub";

Stub satisfies typeof Workarounds;
