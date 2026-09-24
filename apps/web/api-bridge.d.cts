import type { IncomingMessage, ServerResponse } from "node:http";

type ExpressHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => unknown;
type BridgeHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export function createExpressBridge(
  loadApplication: () => ExpressHandler,
  reportError?: () => void,
): BridgeHandler;
export const handleApiRequest: BridgeHandler;
