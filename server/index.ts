import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { CommunicationIdentityClient } from "@azure/communication-identity";

const HUB = "chat";
const signalrConnectionString = process.env.SIGNALR_CONNECTION_STRING ?? "";
const acsConnectionString = process.env.ACS_CONNECTION_STRING ?? "";

const acsClient = new CommunicationIdentityClient(acsConnectionString);

function parseConnectionString(cs: string) {
  const endpoint = /Endpoint=(.*?);/.exec(cs)?.[1];
  const accessKey = /AccessKey=(.*?);/.exec(cs)?.[1];
  return { endpoint, accessKey };
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
    const secret = new TextEncoder().encode(accessKey);
    const accessToken = await new SignJWT({ aud: url })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret);

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
  .listen(3000);

console.log(`server running at http://localhost:${app.server?.port}`);
