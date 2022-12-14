import fs from 'fs'
import logger from './logger.js'

const Configuration = class {
  // Config - default values
  port = 8080
  tlsSupport = false
  certPath = ''
  logFile = './server.log'
  logLevel = 'ERROR'
  privateKeyFile = ''
  includeConfigs = [
    '/path/to/configFolder'
  ]

  repositories = [
    {
      url: 'git@github.com:MonoDepth/Git-Auto-Deploy.git',
      remote: 'origin',
      projectRoot: '/opt/MyProject/',
      secret: '',
      debug: true,
      triggers: [
        {
          type: 'push-commit',
          identifier: 'master',
          deploy: './deploy.sh',
          shell: 'sh -c',
          environmentVars: {
            keyName: 'keyVal'
          },
          statusCallback: [
            {
              service: 'DISCORD',
              webhook: 'https://xxxx'
            }
          ]
        }
      ]
    }
  ]

  async load () {
    return new Promise((resolve, reject) => {
      fs.readFile('./config.json', 'utf8', this.parseData.bind(this, resolve, reject))
    })
  }

  parseData (resolve, reject, err, data) {
    if (err) {
      throw err
    }

    // Inline functions for the parsing
    const getValueDef = (wanted, def, settingName) => {
      if (wanted === null || wanted === undefined || wanted === '') {
        logger.debug(`Using default value ${def} for setting ${settingName}`)
        return def
      }
      logger.debug(`Found value ${wanted} for setting ${settingName}`)
      return wanted
    }

    const validateRepository = (repository) => {
      if (!repository.url) {
        reject('Repository is missing url')
      }

      if (!repository.projectRoot) {
        reject(`projectRoot missing for ${repository.url}`)
      }

      repository.remote = getValueDef(repository.remote, 'origin', 'remote')
      repository.secret = getValueDef(repository.secret, '', 'secret')
      repository.debug = getValueDef(repository.debug, true, 'repository.debug')

      repository.triggers = getValueDef(repository.triggers, [], 'triggers')

      if (repository.triggers.length === 0) {
        reject(`triggers missing for ${repository.url}`)
      }

      const triggerTypes = ['push-commit', 'push-tag', 'release']

      repository.triggers.forEach(trigger => {
        if (!triggerTypes.includes(trigger.type)) {
          reject(`${trigger.type} not a valid type (${repository.url})`)
        }

        if (trigger.identifier === undefined || trigger.identifier === null || trigger.identifier === '') {
          reject(`either branch or tag filter has to be set for ${repository.url} (Use branch identifier '*' to always trigger)`)
        }

        if (!trigger.deploy) {
          reject(`deploy not set for ${repository.url}`)
        }

        trigger.environmentVars = getValueDef(trigger.environmentVars, [], 'trigger.environmentVars')
        trigger.statusCallback = getValueDef(trigger.statusCallback, [], 'trigger.statusCallback')
        trigger.shell = getValueDef(trigger.shell, '', 'trigger.shell')

        trigger.statusCallback.forEach(callback => {
          callback.service = getValueDef(callback.service, null, 'callback.service')?.toUpperCase() ?? reject('callback is missing service attribute')
          if (callback.service !== 'CONSOLE') {
            callback.webhook = getValueDef(callback.webhook, null, 'callback.webhook') ?? reject('callback is missing webhook attribute')
          }
        })
      })
      return true
    }

    const parseIncludeFiles = () => {
      const repositoriesToAdd = []
      this.includeConfigs.forEach(path => {
        fs.readFile(path, 'utf8', function (err, data) {
          if (err) {
            reject(err)
          }
          const includeRepo = JSON.parse(data)
          includeRepo.forEach(repo => {
            if (validateRepository(repo)) {
              repositoriesToAdd.push(repo)
            }
          })
        })
      })
      return repositoriesToAdd
    }

    const parsedObj = JSON.parse(data)

    // Set the loglevel first so the rest of the parsing displays the correct errors
    this.logLevel = getValueDef(parsedObj.logLevel, 'ERROR', 'logLevel')
    this.logFile = getValueDef(parsedObj.logFile, this.logFile, 'logFile')
    logger.setLogLevel(this.logLevel)

    if (this.logFile !== '') {
      logger.addLogFile(this.logFile)
    }

    this.port = getValueDef(parsedObj.port, this.port, 'port')
    this.tlsSupport = getValueDef(parsedObj.tlsSupport, this.tlsSupport, 'tlsSupport')
    this.certPath = getValueDef(parsedObj.tlsSupport, this.certPath, 'certPath')
    this.privateKeyFile = getValueDef(parsedObj.privateKeyFile, this.privateKeyFile, 'privateKeyFile')
    this.includeConfigs = getValueDef(parsedObj.includeConfigs, [], 'includeConfigs')
    this.repositories = getValueDef(parsedObj.repositories, [], 'repositories')
    this.repositories.forEach(repo => {
      validateRepository(repo)
    })
    this.repositories.push(...parseIncludeFiles(this.includeConfigs))
    resolve()
  }
}
export default Configuration
