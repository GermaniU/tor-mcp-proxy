// check_exit_ip — show the IP address that destinations see.
import { z } from "zod";
import { isBlockedStatus } from "../../shared/net/tor.js";
import { failure, statusFailure, success } from "../../shared/mcp/results.js";

export const EXIT_IP_ENDPOINT = "https://api.ipify.org?format=json";

const inputShape = {};
const responseSchema = z.object({ ip: z.union([z.ipv4(), z.ipv6()]) });

export const checkExitIpTool = {
  name: "check_exit_ip",
  definition: {
    title: "Check Exit IP",
    description: "Return the public IP address that destinations see (the Tor exit node of a fresh circuit).",
    inputSchema: inputShape
  },
  schema: z.object(inputShape).strict(),
  logFields: () => ({}),
  handler: checkExitIp
};

export async function checkExitIp(_input, { web }, { endpoint = EXIT_IP_ENDPOINT } = {}) {
  return web.run(async (circuit) => {
    const { response } = await web.fetch(circuit, endpoint, { headers: { accept: "application/json" } });
    const body = await web.readText(response);

    if (!response.ok) {
      return { done: !isBlockedStatus(response.status), result: statusFailure(response.status) };
    }

    let payload;
    try {
      payload = responseSchema.safeParse(JSON.parse(body));
    } catch {
      return { done: true, result: failure("The exit-IP service returned invalid JSON.") };
    }

    if (!payload.success) {
      return { done: true, result: failure("The exit-IP service returned an invalid response.") };
    }

    return { done: true, result: success(`Exit IP: ${payload.data.ip}`) };
  });
}
