import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defineCommand } from "citty";
import { createP6tMcpServer } from "../mcp/server.ts";

export const mcpCommand = defineCommand({
  meta: { name: "mcp", description: "Run the local p6t MCP server over stdio" },
  args: {
    cwd: { type: "string", description: "Project directory used to locate i18n.json" },
  },
  async run({ args }) {
    const server = createP6tMcpServer(path.resolve(args.cwd ?? process.cwd()));
    await server.connect(new StdioServerTransport());
  },
});
