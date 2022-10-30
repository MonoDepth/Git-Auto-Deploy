import fetch from 'node-fetch'
import logger from './logger.js'

const MessageHandler = class {
  _messageService = ''
  _webHook = ''
  constructor (messageService, webHook) {
    this._messageService = messageService
    this._webHook = webHook
  }

  async sendMessage (title, description, color) {
    let data = null
    let response = null
    switch (this._messageService) {
      case 'DISCORD':
        data = {
          username: 'Git Auto Deploy',
          embeds: [
            {
              title,
              type: 'rich',
              color,
              description
            }
          ]
        }
        response = await fetch(this._webHook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        if (!response.ok) {
          const rpl = await response.text()
          throw new Error(`Failed to send message to ${this._messageService} on webhook ${this._webHook} (${rpl})`)
        }
        break
      case 'CONSOLE':
      default:
        logger.log(`[${title}] - ${description}`)
    }
  }
}

export default MessageHandler
