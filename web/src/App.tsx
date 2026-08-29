import { createSignal, createMemo, For, Show } from "solid-js";
import { HubConnectionBuilder } from "@microsoft/signalr";

interface ChatMessage {
  sender: string;
  text: string;
}

export default function App() {
  const [name, setName] = createSignal("");
  const [room, setRoom] = createSignal("");
  const [joined, setJoined] = createSignal(false);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal("");
  const [status, setStatus] = createSignal("");

  const canJoin = createMemo(
    () => name().trim() !== "" && room().trim() !== "",
  );
  const canSend = createMemo(() => input().trim() !== "");

  async function join() {
    if (!canJoin()) return;
    setStatus("connecting...");
    const conn = new HubConnectionBuilder().withUrl("/signalr").build();

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

    setJoined(true);
    setStatus("connected");
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
