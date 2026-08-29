<div align="center">

# Bicep IaC (Infrastructure as Code)

<p>Perintah-perintah terminal step by step</p>

[![Azure](https://img.shields.io/badge/Azure-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com)
[![Bicep](https://img.shields.io/badge/Bicep-519ADA?style=for-the-badge&logo=azure&logoColor=white)](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)

</div>

### Memulai
```ps1
az login
az group create -n realtime-chat-rg -l indonesiacentral
az deployment group create -g realtime-chat-rg --template-file main.bicep

# ambil connection string (isi ke server/.env)
az signalr key list -g realtime-chat-rg -n rtchat-signalr
az communication list-key --name rtchat-acs --resource-group realtime-chat-rg
```