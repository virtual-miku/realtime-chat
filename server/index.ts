import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { CommunicationIdentityClient } from "@azure/communication-identity";

const HUB = "chat";
const signalrConnectionString = process.env.SIGNALR_CONNECTION_STRING ?? "";
const acsConnectionString = process.env.ACS_CONNECTION_STRING ?? "";

const acsClient = new CommunicationIdentityClient(acsConnectionString);

const presence = new Map<string, number>();
const userNumbers = new Map<
  string,
  { group: string; name: string; number: number }
>();

function parseConnectionString(cs: string) {
  const endpoint = /Endpoint=(.*?);/.exec(cs)?.[1];
  const accessKey = /AccessKey=(.*?);/.exec(cs)?.[1];
  return { endpoint, accessKey };
}

async function signToken(accessKey: string, aud: string) {
  const secret = new TextEncoder().encode(accessKey);
  return new SignJWT({ aud })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
}

const app = new Elysia()
  .get("/", () => "server is running")
  .post("/signalr/negotiate", async () => {
    const { endpoint, accessKey } = parseConnectionString(
      signalrConnectionString,
    );
    if (!endpoint || !accessKey) {
      return new Response("SIGNALR_CONNECTION_STRING not configured", {
        status: 500,
      });
    }
    const url = `${endpoint}/client/?hub=${HUB}`;
    const accessToken = await signToken(accessKey, url);
    return { url, accessToken };
  })
  .post("/acs/token", async () => {
    if (!acsConnectionString) {
      return new Response("ACS_CONNECTION_STRING not configured", {
        status: 500,
      });
    }
    const user = await acsClient.createUser();
    const tokenResponse = await acsClient.getToken(user, ["voip"]);
    return {
      userId: user.communicationUserId,
      token: tokenResponse.token,
      expiresOn: tokenResponse.expiresOn,
    };
  })
  .post("/signalr/join", async ({ body }) => {
    const { endpoint, accessKey } = parseConnectionString(
      signalrConnectionString,
    );
    if (!endpoint || !accessKey) {
      return new Response("SIGNALR_CONNECTION_STRING not configured", {
        status: 500,
      });
    }

    const { group, connectionId, name } = body as {
      group: string;
      connectionId: string;
      name: string;
    };
    if (!group || !connectionId || !name) {
      return new Response("group, connectionId, name required", {
        status: 400,
      });
    }

    const restUrl = `${endpoint}/api/v1/hubs/${HUB}/groups/${encodeURIComponent(group)}/connections/${encodeURIComponent(connectionId)}`;
    const accessToken = await signToken(accessKey, restUrl);
    const res = await fetch(restUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return new Response(
        `SignalR join failed: ${res.status} ${await res.text()}`,
        { status: 502 },
      );
    }

    const key = `${group}::${name}`;
    const count = presence.get(key) ?? 0;
    const number = count + 1;
    presence.set(key, count + 1);
    userNumbers.set(connectionId, { group, name, number });

    return { ok: true, number };
  })
  .post("/signalr/leave", async ({ body }) => {
    const { connectionId } = body as { connectionId: string };
    const entry = userNumbers.get(connectionId);
    if (entry) {
      const key = `${entry.group}::${entry.name}`;
      const count = presence.get(key) ?? 0;
      if (count > 1) presence.set(key, count - 1);
      else presence.delete(key);
      userNumbers.delete(connectionId);
    }
    return { ok: true };
  })
  .post("/signalr/send", async ({ body }) => {
    const { endpoint, accessKey } = parseConnectionString(
      signalrConnectionString,
    );
    if (!endpoint || !accessKey) {
      return new Response("SIGNALR_CONNECTION_STRING not configured", {
        status: 500,
      });
    }

    const { group, sender, text, connectionId, number } = body as {
      group: string;
      sender: string;
      text: string;
      connectionId?: string;
      number?: number;
    };
    if (!group || !sender || !text) {
      return new Response("group, sender, text required", { status: 400 });
    }

    const key = `${group}::${sender}`;
    const nameCount = presence.get(key) ?? 1;

    const restUrl = `${endpoint}/api/v1/hubs/${HUB}/groups/${encodeURIComponent(group)}`;
    const accessToken = await signToken(accessKey, restUrl);

    const res = await fetch(restUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        Target: "message",
        Arguments: [sender, text, connectionId ?? "", number ?? 1, nameCount],
      }),
    });

    if (!res.ok) {
      return new Response(
        `SignalR send failed: ${res.status} ${await res.text()}`,
        { status: 502 },
      );
    }

    return { ok: true };
  })
  .listen(3000);

console.log(`server running at http://localhost:${app.server?.port}`);
