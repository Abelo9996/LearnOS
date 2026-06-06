import { ToolError } from "./ToolError.mjs";
/**
 * Resolve the registry key for a tool — the name the model addresses it by.
 * MCP toolsets are keyed on `mcp_server_name`; every other tool on `name`.
 * Shared so the tool-name lookup is identical across `toolRunner()` surfaces.
 */
export function toolName(tool) {
    return 'name' in tool ? tool.name : tool.mcp_server_name;
}
/**
 * Format a thrown value into tool-result content: a {@link ToolError} carries
 * its own structured content, anything else becomes an `Error: <message>`
 * string. Shared so every `toolRunner()` surface reports tool failures the
 * same way to the model.
 */
export function toolErrorContent(e) {
    return e instanceof ToolError ? e.content : `Error: ${e instanceof Error ? e.message : String(e)}`;
}
/**
 * Run a {@link BetaRunnableTool} end-to-end: parse the raw input, invoke `run`,
 * and format any thrown value via {@link toolErrorContent}. Shared so the
 * parse → run → catch → format pipeline is identical across `toolRunner()`
 * surfaces.
 */
export async function runRunnableTool(tool, rawInput, context) {
    try {
        const input = tool.parse ? tool.parse(rawInput) : rawInput;
        const content = await tool.run(input, context);
        return { content, isError: false };
    }
    catch (e) {
        return { content: toolErrorContent(e), isError: true };
    }
}
//# sourceMappingURL=BetaRunnableTool.mjs.map