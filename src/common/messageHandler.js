import fetch from 'node-fetch'

const messageHandler = class {
  _messageService = ""
  _webHook = ""
  constructor(messageService, webHook) {
    this._messageService = messageService
    this._webHook = webHook
  }

  async sendMessage(title, description, color) {
    switch(this._messageService) {
      case 'DISCORD': 
      default:
        const data = {
          username: "Git Auto Deploy",
          embeds: [
            {
              title: title,
              type: "rich",
              color: color,
              description: description
            }
          ]
        }
        const response = await fetch(this._webHook, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
        if (!response.ok) {
          const rpl = await response.text()
          throw `Failed to send message to ${this._messageService} on webhook ${this._webHook} (${rpl})`
        }
    }
  }
}

export default messageHandler