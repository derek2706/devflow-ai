import type { IncomingMessage, ServerResponse } from "node:http";

type ExpressHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => unknown;
type BridgeHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;
type FailureStage =
  | "environment-module"
  | "environment-validation"
  | "application-module"
  | "request-handling";
type BackendLoader = (
  setStage: (stage: FailureStage) => void,
) => ExpressHandler;
type FailureDiagnostic = {
  stage: FailureStage;
  errorName: string;
  errorCode?: string;
  configurationKeys?: string[];
  module?: string;
};

export function createExpressBridge(
  loadApplication: BackendLoader,
  reportError?: (diagnostic: FailureDiagnostic) => void,
): BridgeHandler;
export function createBackendLoader(dependencies?: {
  loadEnvironment?: () => { getEnv: () => unknown };
  loadApplication?: () => { default: ExpressHandler };
}): BackendLoader;
export const handleApiRequest: BridgeHandler;
