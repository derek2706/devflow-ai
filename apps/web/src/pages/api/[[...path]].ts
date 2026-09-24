import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiRequest } from "../../../api-bridge.cjs";

// Express owns body parsing, security middleware, routes, and error responses.
export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  return handleApiRequest(request, response);
}
