import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppContext } from "../../src/context.ts";
import { buildServer } from "../../src/server.ts";

describe("read-only Wanderlog MCP server", () => {
  let client: Client;
  let server: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = buildServer({} as AppContext);
    client = new Client({ name: "metadata-test", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("publishes only the two trip viewing tools", async () => {
    const response = await client.listTools();
    expect(response.tools.map((tool) => tool.name).sort()).toEqual([
      "wanderlog_get_trip",
      "wanderlog_list_trips",
    ]);
    for (const tool of response.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("rejects requests to create a trip", async () => {
    const result = await client.callTool({ name: "wanderlog_create_trip", arguments: {} });
    expect(result.isError).toBe(true);
  });
});
