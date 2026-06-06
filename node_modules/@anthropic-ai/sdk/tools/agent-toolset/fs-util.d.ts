/**
 * Shared, Node-only filesystem helpers for the agent toolset's file tools:
 * path confinement (symlink-aware), an atomic write, and language-independent
 * error messages. Kept out of `node.ts` so the tool implementations stay focused
 * and these helpers can be reused by every file tool.
 */
/** Mode for directories the file tools create — not world-writable under a 0 umask. */
export declare const DIR_CREATE_MODE = 493;
/** Mode for files the file tools create. */
export declare const FILE_CREATE_MODE = 420;
/**
 * Fully resolve `abs`: `realpath` the longest existing ancestor and re-append
 * the rest, but never re-append a component that is itself a symlink — read the
 * link and continue from its target instead. This handles paths being created
 * (write/edit) without letting a symlink leaf (e.g. a dangling one pointing
 * outside a confinement root) slip through unresolved.
 */
export declare function canonicalize(abs: string): Promise<string>;
/**
 * Resolve `p` and confine it to `root`.
 *
 * Unless `allowOutside` is set, absolute inputs are rejected and the
 * **canonical** path is returned — every symlink in `p` (including the leaf,
 * even a dangling one) is resolved before the confinement check, and the
 * resolved path is what the caller then operates on, so a symlink inside `root`
 * that points outside it can neither pass the check nor be followed afterwards.
 *
 * Residual TOCTOU: a component could still be swapped for a symlink between this
 * call and the eventual `fs` operation. Closing that fully needs per-component
 * `O_NOFOLLOW`/`openat`, which Node does not expose ergonomically; this is why a
 * sandbox is still recommended for the toolset as a whole.
 */
export declare function confineToRoot(root: string, p: string, opts?: {
    allowOutside?: boolean;
}): Promise<string>;
/**
 * Atomically write `content` to `targetPath`: write a sibling temp file, fsync
 * it, then rename over the target. The rename is atomic on most filesystems, so
 * a crash mid-write never leaves the target half-written.
 */
export declare function atomicWriteFile(targetPath: string, content: string): Promise<void>;
/**
 * Map a thrown filesystem error to a consistent, language-independent message,
 * so the model sees the same wording regardless of the runtime (Node's raw
 * `ENOENT: no such file...` text would otherwise leak through). Falls back to
 * the raw error message for codes we don't special-case.
 */
export declare function fsErrorMessage(err: unknown, file: string): string;
//# sourceMappingURL=fs-util.d.ts.map