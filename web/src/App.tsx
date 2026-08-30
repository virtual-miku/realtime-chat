import { createSignal, createMemo, For, Show } from "solid-js";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { CallClient } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

interface ChatMessage {
  sender: string;
  text: string;
  connectionId: string;
  number: number;
  nameCount: number;
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

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 70%, 45%)`;
}

export default function App() {
  const [name, setName] = createSignal("");
  const [room, setRoom] = createSignal("");
  const [joined, setJoined] = createSignal(false);
  const [joining, setJoining] = createSignal(false);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal("");
  const [muted, setMuted] = createSignal(true);
  const [callReady, setCallReady] = createSignal(false);
  const [myNumber, setMyNumber] = createSignal(1);

  let conn: any = null;
  let call: any = null;

  const canJoin = createMemo(
    () => name().trim() !== "" && room().trim() !== "",
  );
  const canSend = createMemo(() => input().trim() !== "");

  async function join() {
    if (!canJoin() || joining()) return;
    setJoining(true);
    console.log("connecting...");

    try {
      conn = new HubConnectionBuilder().withUrl("/signalr").build();
      conn.on(
        "message",
        (
          sender: string,
          text: string,
          connectionId: string,
          number: number,
          nameCount: number,
        ) => {
          setMessages((prev) => [
            ...prev,
            { sender, text, connectionId, number, nameCount },
          ]);
        },
      );
      await conn.start();

      const res = await fetch("/signalr/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: room(),
          connectionId: conn.connectionId,
          name: name(),
        }),
      });
      if (!res.ok) {
        console.error("gagal join group");
        return;
      }
      const { number } = await res.json();
      setMyNumber(number);

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
          if (call?.state === "Connected") {
            setCallReady(true);
            call.mute();
          }
        });
      } catch (e) {
        console.error("voice join failed", e);
        console.error("chat connected, voice gagal");
      }

      setJoined(true);
      console.log("connected");
    } finally {
      setJoining(false);
    }
  }

  async function toggleMute() {
    if (!call || !callReady()) return;
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
      body: JSON.stringify({
        group: room(),
        sender: name(),
        text,
        connectionId: conn?.connectionId,
        number: myNumber(),
      }),
    });
    setInput("");
  }

  async function leave() {
    if (call) {
      await call.hangUp();
      call = null;
    }
    if (conn) {
      await fetch("/signalr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: conn.connectionId }),
      }).catch(() => {});
      await conn.stop();
      conn = null;
    }
    setJoined(false);
    setMessages([]);
    setMuted(true);
    setCallReady(false);
  }

  return (
    <main>
      <h1>Miku Realtime Chat</h1>
      <Show
        when={joined()}
        fallback={
          <div class="join-form">
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
            <button onClick={join} disabled={!canJoin() || joining()}>
              <Show when={joining()} fallback="Join">
                <span class="loading">
                  <span class="spinner" /> Joining...
                </span>
              </Show>
            </button>
          </div>
        }
      >
        <div class="room-header">
          <p class="room-info">
            Room: <b>{room()}</b>
          </p>
        </div>
        <div class="controls">
          <div class="mic-control">
            <span class="mic-icon">{muted() ? "🔇" : "🎤"}</span>
            <button class="mute" onClick={toggleMute} disabled={!callReady()}>
              {muted() ? "Unmute" : "Mute"}
            </button>
          </div>
          <button class="leave" onClick={leave}>
            Leave
          </button>
        </div>
        <div class="messages">
          <For each={messages()}>
            {(msg) => {
              const isOwn = msg.connectionId === conn?.connectionId;
              return (
                <div class={`message ${isOwn ? "own" : ""}`}>
                  <span
                    class="sender"
                    style={{ color: colorFromId(msg.connectionId) }}
                  >
                    {msg.sender}
                    <Show when={msg.nameCount > 1}>
                      <span class="suffix"> (#{msg.number})</span>
                    </Show>
                  </span>
                  <span class="text">{msg.text}</span>
                </div>
              );
            }}
          </For>
        </div>
        <form
          class="chat-form"
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
