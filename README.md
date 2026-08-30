<div align="center">

# Miku Realtime Chat

<p>Chat + voice call real-time di Azure (SignalR + Communication Services)</p>

[![Azure](https://img.shields.io/badge/Azure-0078D4?style=for-the-badge)](https://azure.microsoft.com)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![Elysia](https://img.shields.io/badge/Elysia-0078FF?style=for-the-badge)](https://elysiajs.com)
[![SolidJS](https://img.shields.io/badge/SolidJS-2C4F7C?style=for-the-badge&logo=solid&logoColor=white)](https://www.solidjs.com)
[![SignalR](https://img.shields.io/badge/SignalR-512BD4?style=for-the-badge)](https://azure.microsoft.com/products/signalr-service/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

| Desktop Preview | Mobile Preview |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/8e5b6e67-7743-41d0-a107-b50333c5722b" width="100%" alt="home-desktop"> | <img src="https://github.com/user-attachments/assets/8bc3c58e-0c4d-4b6d-9979-1dcd0e3b28c8" width="100%" alt="home"> |
| <img src="https://github.com/user-attachments/assets/e71d8b1e-fc6a-4cfc-a95a-424d2e0c7a33" width="100%" alt="chat-desktop"> | <img src="https://github.com/user-attachments/assets/7543bc21-20ec-4a47-a35f-2ad525d4207a" width="100%" alt="chat"> |

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

### Deployment

```ps1
cd web
bun run build
cd ..

Compress-Archive -Path server, web\dist -DestinationPath realtime-chat.zip -Force

az vm create `
  --resource-group realtime-chat-rg `
  --name RealtimeChatVM `
  --image Ubuntu2204 `
  --size Standard_D2as_v5 `
  --admin-username azureuser `
  --generate-ssh-keys `
  --location indonesiacentral

az vm open-port --resource-group realtime-chat-rg --name RealtimeChatVM --port 80 --priority 1001
az vm open-port --resource-group realtime-chat-rg --name RealtimeChatVM --port 443 --priority 1002

scp realtime-chat.zip azureuser@48.193.47.93:~/

ssh azureuser@48.193.47.93
```

```bash
sudo apt update && sudo apt install -y unzip nginx

curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

unzip realtime-chat.zip -d realtime-chat

cd ~/realtime-chat/server
bun install --production

sudo tee /etc/systemd/system/realtime-chat.service > /dev/null << 'EOF'
[Unit]
Description=Realtime Chat Backend (Bun)
After=network.target

[Service]
Type=simple
User=azureuser
WorkingDirectory=/home/azureuser/realtime-chat/server
ExecStart=/home/azureuser/.bun/bin/bun run index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now realtime-chat
sudo systemctl status realtime-chat --no-pager

curl http://localhost:3000 # output yang diharapkan: server is running

sudo bash -c 'cat << "EOF" > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name _;

    root /home/azureuser/realtime-chat/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ ^/(signalr|acs)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF'

chmod +x /home/azureuser
chmod -R o+rX /home/azureuser/realtime-chat

sudo nginx -t
sudo systemctl restart nginx
```

#### Buka terminal baru

```ps1
az network public-ip list --resource-group realtime-chat-rg --query "[].{Name:name}" -o table

az network public-ip update --resource-group realtime-chat-rg --name RealtimeChatVMPublicIP --dns-name realtimechat
```

#### Kembali ke SSH VM sebelumnya

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

sudo bash -c 'cat << "EOF" > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name realtimechat.indonesiacentral.cloudapp.azure.com;
    root /home/azureuser/realtime-chat/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~ ^/(signalr|acs)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF'

sudo nginx -t
sudo systemctl reload nginx

sudo certbot install --cert-name realtimechat.indonesiacentral.cloudapp.azure.com
```

#### Jalankan di `https://realtimechat.indonesiacentral.cloudapp.azure.com`

### Menghentikan

```ps1
az vm deallocate --resource-group realtime-chat-rg --name RealtimeChatVM
```

### Menghapus resource group
⚠️ Tindakan ini bersifat permanen dan tidak dapat dipulihkan.
```ps1
az group delete --name realtime-chat-rg --yes
```