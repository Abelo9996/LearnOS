"use strict";
/**
 * Shared, Node-only filesystem helpers for the agent toolset's file tools:
 * path confinement (symlink-aware), an atomic write, and language-independent
 * error messages. Kept out of `node.ts` so the tool implementations stay focused
 * and these helpers can be reused by every file tool.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_CREATE_MODE = exports.DIR_CREATE_MODE = void 0;
exports.canonicalize = canonicalize;
exports.confineToRoot = confineToRoot;
exports.atomicWriteFile = atomicWriteFile;
exports.fsErrorMessage = fsErrorMessage;
const tslib_1 = require("../../internal/tslib.js");
const fs = tslib_1.__importStar(require("node:fs/promises"));
const path = tslib_1.__importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const ToolError_1 = require("../../lib/tools/ToolError.js");
/** Mode for directories the file tools create — not world-writable under a 0 umask. */
exports.DIR_CREATE_MODE = 0o755;
/** Mode for files the file tools create. */
exports.FILE_CREATE_MODE = 0o644;
/** `realpath` `p`, or return `p` unchanged when it cannot be resolved. */
async function realpathOrSelf(p) {
    try {
        return await fs.realpath(p);
    }
    catch {
        return p;
    }
}
/**
 * Fully resolve `abs`: `realpath` the longest existing ancestor and re-append
 * the rest, but never re-append a component that is itself a symlink — read the
 * link and continue from its target instead. This handles paths being created
 * (write/edit) without letting a symlink leaf (e.g. a dangling one pointing
 * outside a confinement root) slip through unresolved.
 */
async function canonicalize(abs) {
    const tail = [];
    let prefix = abs;
    for (;;) {
        let real;
        try {
            real = await fs.realpath(prefix);
        }
        catch {
            let isLink = false;
            try {
                isLink = (await fs.lstat(prefix)).isSymbolicLink();
            }
            catch {
                /* prefix truly doesn't exist (ENOENT) — fall through and walk up */
            }
            if (isLink) {
                // Resolve the symlink ourselves and retry; `tail` (the part below it)
                // still applies to the link's target.
                prefix = path.resolve(path.dirname(prefix), await fs.readlink(prefix));
                continue;
            }
            const parent = path.dirname(prefix);
            if (parent === prefix)
                return abs; // walked past the FS root without a hit
            tail.push(path.basename(prefix));
            prefix = parent;
            continue;
        }
        return tail.length ? path.join(real, ...tail.reverse()) : real;
    }
}
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
async function confineToRoot(root, p, opts) {
    const allowOutside = opts?.allowOutside ?? false;
    if (path.isAbsolute(p)) {
        if (!allowOutside) {
            throw new ToolError_1.ToolError(`absolute path ${JSON.stringify(p)} not permitted`);
        }
        return path.resolve(p);
    }
    const realRoot = await realpathOrSelf(path.resolve(root));
    const abs = path.resolve(realRoot, p);
    if (allowOutside)
        return abs;
    const real = await canonicalize(abs);
    const rootSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (real !== realRoot && !real.startsWith(rootSep)) {
        throw new ToolError_1.ToolError(`path ${JSON.stringify(p)} escapes workdir`);
    }
    return real;
}
/**
 * Atomically write `content` to `targetPath`: write a sibling temp file, fsync
 * it, then rename over the target. The rename is atomic on most filesystems, so
 * a crash mid-write never leaves the target half-written.
 */
async function atomicWriteFile(targetPath, content) {
    const dir = path.dirname(targetPath);
    const tempPath = path.join(dir, `.tmp-${process.pid}-${(0, node_crypto_1.randomUUID)()}`);
    let handle;
    try {
        handle = await fs.open(tempPath, 'wx', exports.FILE_CREATE_MODE);
        await handle.writeFile(content, 'utf-8');
        await handle.sync();
        await handle.close();
        handle = undefined;
        await fs.rename(tempPath, targetPath);
    }
    catch (err) {
        if (handle)
            await handle.close().catch(() => { });
        await fs.unlink(tempPath).catch(() => { });
        throw err;
    }
}
/**
 * Map a thrown filesystem error to a consistent, language-independent message,
 * so the model sees the same wording regardless of the runtime (Node's raw
 * `ENOENT: no such file...` text would otherwise leak through). Falls back to
 * the raw error message for codes we don't special-case.
 */
function fsErrorMessage(err, file) {
    const code = err?.code;
    switch (code) {
        case 'ENOENT':
            return `${file}: no such file or directory`;
        case 'EACCES':
        case 'EPERM':
            return `${file}: permission denied`;
        case 'ENOTDIR':
            return `${file}: not a directory`;
        case 'EISDIR':
            return `${file}: is a directory`;
        case 'ELOOP':
            return `${file}: too many levels of symbolic links`;
        case 'ENAMETOOLONG':
            return `${file}: file name too long`;
        case 'ENOSPC':
            return `${file}: no space left on device`;
        case 'EMFILE':
        case 'ENFILE':
            return `${file}: too many open files`;
        default:
            return `${file}: ${err instanceof Error ? err.message : String(err)}`;
    }
}
//# sourceMappingURL=fs-util.js.map