/**
 * Node-only skill plumbing for the agent toolset: downloading a session
 * agent's skills into the workdir and extracting the archives. Kept in its own
 * file because it is a distinct concern from the tool implementations in
 * `node.ts` — distinct enough, and large enough, to review on its own.
 */
import type { Anthropic } from "../../client.mjs";
import type { AgentToolContext } from "./node.mjs";
/**
 * Download the session agent's skills into `{ctx.workdir}/skills/<name>/`.
 *
 * No-op (returns a no-op cleanup) unless both `ctx.client` and `ctx.sessionId`
 * are set. Looks up the session's resolved agent and, for each skill, fetches
 * its files via `client.beta.skills.versions.download` and extracts the archive
 * (a zip or tar.* archive) into a directory named after the skill. A failure on
 * one skill is logged and does not block the others. Call this before starting
 * the session tool runner (e.g. right after the bash session / workdir is
 * ready).
 *
 * Returns a cleanup function that removes the skill directories this call
 * created — call it once the work item is done so downloaded skills do not
 * accumulate in the workdir across sessions.
 */
export declare function setupSkills(ctx: AgentToolContext): Promise<() => Promise<void>>;
/**
 * Resolve `version` to the concrete numeric timestamp the
 * `/v1/skills/{id}/versions/{version}` endpoints require — `session.agent.skills[].version`
 * can be an alias such as `"latest"`, which those endpoints reject. Numeric
 * versions pass through unchanged.
 */
export declare function resolveSkillVersion(client: Anthropic, skillId: string, version: string): Promise<string>;
/**
 * Extract a skill download (a zip or tar.* archive) into `dest`. Streams the
 * response body straight to a temp file beside `dest` (so the whole archive is
 * never buffered in memory — skills can contain large binaries), then shells out
 * to `unzip`/`tar` — consistent with the rest of the toolset, which already
 * invokes `bash` and `rg`. Both `unzip` and `tar` must be available on `PATH`; a
 * missing binary surfaces as a clear error (see {@link runArchiveTool}). Refuses
 * any member that would escape `dest` (zip-slip / tar-slip), including
 * symlink/hardlink members: skill archives come from the API, but skills can be
 * third-party.
 *
 * The skill bundle's single wrapper directory is stripped: the archive is
 * extracted into a staging dir and the wrapper's contents are promoted into
 * `dest`, so files land at `dest/SKILL.md` rather than a doubled
 * `dest/<skill>/SKILL.md` (`unzip` has no `--strip-components`, so this is
 * done uniformly by staging + promote rather than per-tool flags).
 */
export declare function extractSkillArchive(resp: Response, dest: string): Promise<void>;
//# sourceMappingURL=skills.d.mts.map