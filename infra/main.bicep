param location string = 'indonesiacentral'
param signalrName string = 'rtchat-signalr'
param acsName string = 'rtchat-acs'

resource signalr 'Microsoft.SignalRService/signalR@2024-03-01' = {
  name: signalrName
  location: location
  sku: {
    name: 'Standard_S1'
    capacity: 1
  }
  kind: 'SignalR'
  properties: {
    features: [
      { flag: 'ServiceMode', value: 'Serverless' }
    ]
  }
}

resource acs 'Microsoft.Communication/communicationServices@2023-03-31' = {
  name: acsName
  location: 'global'
  properties: {
    dataLocation: 'Asia Pacific'
  }
}

output signalrName string = signalr.name
output acsName string = acs.name