import { Elysia } from 'elysia';
import { SignJWT } from 'jose';

const HUB = 'chat';
const connectionString = process.env.SIGNALR_CONNECTION_STRING ?? '';

function parseConnectionString(cs: string) {
  const endpoint = /Endpoint=(.*?);/.exec(cs)?.[1];
  const accessKey = /AccessKey=(.*?);/.exec(cs)?.[1];
  return { endpoint, accessKey };
}

const app = new Elysia()
  .get('/', () => 'server is running')
  .post('/signalr/negotiate', async () => {
    const { endpoint, accessKey } = parseConnectionString(connectionString);
    if (!endpoint || !accessKey) {
      return new Response('SIGNALR_CONNECTION_STRING not configured', { status: 500 });
    }

    const url = `${endpoint}/client/?hub=${HUB}`;

    const secret = new TextEncoder().encode(accessKey);
    const accessToken = await new SignJWT({ aud: url })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);

    return { url, accessToken };
  })
  .listen(3000);

console.log(`server running at http://localhost:${app.server?.port}`);