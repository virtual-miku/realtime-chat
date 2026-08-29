import { createSignal, createMemo, For, Show } from "solid-js";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { CallClient } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

interface ChatMessage {
  sender: string;
  text: string;
}

async function roomToGroupId(room: string): Promise<string> {
  const data = new TextEncoder().encode(room);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(hash).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function App() {
  const [name, setName] = createSignal("");
  const [room, setRoom] = createSignal("");
  const [joined, setJoined] = createSignal(false);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [muted, setMuted] = createSignal(false);

  let conn: any = null;
  let call: any = null;

  const canJoin = createMemo(
    () => name().trim() !== "" && room().trim() !== "",
  );
  const canSend = createMemo(() => input().trim() !== "");

  async function join() {
    if (!canJoin()) return;
    setStatus("connecting...");

    conn = new HubConnectionBuilder().withUrl("/signalr").build();
    conn.on("message", (sender: string, text: string) => {
      setMessages((prev) => [...prev, { sender, text }]);
    });
    await conn.start();

    const res = await fetch("/signalr/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: room(), connectionId: conn.connectionId }),
    });
    if (!res.ok) {
      setStatus("gagal join group");
      return;
    }

    try {
      const tokenRes = await fetch("/acs/token", { method: "POST" });
      const { token } = await tokenRes.json();

      const callClient = new CallClient();
      const callAgent = await callClient.createCallAgent(
        new AzureCommunicationTokenCredential(token),
      );
      const groupId = await roomToGroupId(room());
      call = callAgent.join({ groupId });
      call.on("stateChanged", () => {
        setStatus(`call: ${call?.state}`);
      });
    } catch (e) {
      console.error("voice join failed", e);
      setStatus("chat connected, voice gagal");
    }

    setJoined(true);
    setStatus("connected");
  }

  async function toggleMute() {
    if (!call) return;
    if (muted()) {
      await call.unmute();
      setMuted(false);
    } else {
      await call.mute();
      setMuted(true);
    }
  }

  async function send() {
    const text = input().trim();
    if (!text) return;
    await fetch("/signalr/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: room(), sender: name(), text }),
    });
    setInput("");
  }

  async function leave() {
    if (call) {
      await call.hangUp();
      call = null;
    }
    if (conn) {
      await conn.stop();
      conn = null;
    }
    setJoined(false);
    setMessages([]);
    setMuted(false);
    setStatus("");
  }

  return (
    <main>
      <h1>Miku Realtime Chat</h1>
      <Show
        when={joined()}
        fallback={
          <div>
            <input
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="nama"
            />
            <input
              value={room()}
              onInput={(e) => setRoom(e.currentTarget.value)}
              placeholder="room"
            />
            <button onClick={join} disabled={!canJoin()}>
              Join
            </button>
          </div>
        }
      >
        <p>
          Room: {room()} | Status: {status()}
        </p>
        <div>
          <button onClick={toggleMute}>{muted() ? "Unmute" : "Mute"}</button>{" "}
          <button onClick={leave}>Leave</button>
        </div>
        <div class="messages">
          <For each={messages()}>
            {(msg) => (
              <p>
                <b>{msg.sender}:</b> {msg.text}
              </p>
            )}
          </For>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            placeholder="ketik pesan..."
          />
          <button type="submit" disabled={!canSend()}>
            Kirim
          </button>
        </form>
      </Show>
    </main>
  );
}
