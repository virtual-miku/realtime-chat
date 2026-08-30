<div align="center">

# Realtime Chat

<p>Chat + voice call real-time di Azure (SignalR + Communication Services)</p>

[![Azure](https://img.shields.io/badge/Azure-0078D4?style=for-the-badge)](https://azure.microsoft.com)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![Elysia](https://img.shields.io/badge/Elysia-0078FF?style=for-the-badge)](https://elysiajs.com)
[![SolidJS](https://img.shields.io/badge/SolidJS-2C4F7C?style=for-the-badge&logo=solid&logoColor=white)](https://www.solidjs.com)
[![SignalR](https://img.shields.io/badge/SignalR-512BD4?style=for-the-badge)](https://azure.microsoft.com/products/signalr-service/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

### Memulai
#### Deploy infrastructure
```ps1
cp server/.env.example server/.env
cd infra
az login
az group create -n realtime-chat-rg -l indonesiacentral
az deployment group create -g realtime-chat-rg --template-file main.bicep

az signalr key list -g realtime-chat-rg -n rtchat-signalr
az communication list-key --name rtchat-acs --resource-group realtime-chat-rg
```
#### Ambil connection string dari output perintah tersebut dan isi ke `server/.env`

#### Install dependency server & web
```ps1
cd server
bun install
cd ../web
bun install
```

---

### Menjalankan
#### Terminal 1 - backend
```ps1
cd server
bun run index.ts
```
#### Terminal 2 - frontend
```ps1
cd web
bun run dev
```
#### Buka `http://localhost:5173` di dua tab browser, isi nama & room yang sama, lalu Join.

---

### Struktur Project
```
realtime-chat/
├── infra/          # Bicep IaC (SignalR + Communication Services)
│   ├── main.bicep
│   └── README.md
├── server/         # Backend Bun + Elysia
│   ├── index.ts    # endpoint: /signalr/negotiate, /signalr/join, /signalr/send, /acs/token
│   └── .env.example
└── web/            # Frontend Vite + SolidJS
    ├── src/App.tsx # UI chat + voice call
    └── vite.config.ts
```