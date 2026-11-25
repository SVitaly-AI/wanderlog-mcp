import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext } from "./context.js";
import { VERSION } from "./version.js";
import { getTrip, getTripDescription, getTripInputSchema } from "./tools/get-trip.js";
import { listTrips, listTripsDescription, listTripsInputSchema } from "./tools/list-trips.js";

const AUTH_ERROR_RESPONSE = {
  content: [
    {
      type: "text" as const,
      text: "Authentication required. Update WANDERLOG_COOKIE with a valid connect.sid cookie from wanderlog.com and restart the server.",
    },
  ],
  isError: true,
};

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}>;

const lazyAuthAttempts = new WeakMap<AppContext, Promise<boolean>>();

async function ensureAuthenticated(ctx: AppContext): Promise<boolean> {
  if (ctx.authenticated) return true;

  let attempt = lazyAuthAttempts.get(ctx);
  if (!attempt) {
    attempt = ctx.rest
      .getUser()
      .then((user) => {
        ctx.userId = user.id;
        ctx.authenticated = true;
        return true;
      })
      .catch(() => false);
    lazyAuthAttempts.set(ctx, attempt);
  }

  return attempt;
}

export function requireAuth(ctx: AppContext, handler: ToolHandler) {
  return async (args: Record<string, unknown>) => {
    if (!(await ensureAuthenticated(ctx))) return AUTH_ERROR_RESPONSE;
    return handler(args);
  };
}

const SERVER_INSTRUCTIONS = "Read-only access to the user's Wanderlog trips and itineraries.";

export function buildServer(ctx: AppContext): McpServer {
  const server = new McpServer(
    { name: "wanderlog-mcp", version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "wanderlog_list_trips",
    {
      title: "List Wanderlog trips",
      description: listTripsDescription,
      inputSchema: listTripsInputSchema,
      annotations: { readOnlyHint: true },
    },
    requireAuth(ctx, async (args) => listTrips(ctx, args as Parameters<typeof listTrips>[1])),
  );

  server.registerTool(
    "wanderlog_get_trip",
    {
      title: "Get a Wanderlog trip",
      description: getTripDescription,
      inputSchema: getTripInputSchema,
      annotations: { readOnlyHint: true },
    },
    requireAuth(ctx, async (args) => getTrip(ctx, args as Parameters<typeof getTrip>[1])),
  );

  return server;
}
