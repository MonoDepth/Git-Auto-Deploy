import fs from 'fs'
import logger from './logger.js'

const config = class {
  //Config - default values  
  port = 8080
  tlsSupport = false
  certPath = ""
  logPath = './logFile.log'
  logLevel = 'ERROR'
  includeConfigs = [
    '/path/to/configFolder'
  ]
  repositories = [
    {
      url: "git@github.com:MonoDepth/Git-Auto-Deploy.git",
      remote: "origin",
      projectRoot: "/opt/MyProject/",
      secret: "",
      triggers: [
        {
          type: "push-commit",
          identifier: "master",
          deploy: "./deploy.sh"
        }        
      ]
    }
  ]

  async load() { 
    return new Promise((resolve, reject) => {
        fs.readFile('./config.json', 'utf8',  this.parseData.bind(this, resolve, reject))
    })        
  }  

  parseData(resolve, reject, err, data) {
    if (err) {
      throw err
    }          

    //Inline functions for the parsing
    const getValueDef = (wanted, def, settingName) => {
      if (wanted === null || wanted === undefined || wanted === '') {          
        logger.info(`Using default value ${def} for setting ${settingName}`)
        return def
      }
      logger.info(`Found value ${wanted} for setting ${settingName}`)
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
      })
      return true
    }


    const parseIncludeFiles = () => {
      const repositoriesToAdd = []
      this.includeConfigs.forEach(path => {
        fs.readFile(path, 'utf8', function (err,data) {
          if (err) {
            reject(err)
          }
          let includeRepo = JSON.parse(data);
          includeRepo.forEach(repo => {
            if (validateRepository(repo)) {
              repositoriesToAdd.push(repo)
            }              
          })
        })
      })
      return repositoriesToAdd
    }
    
    let parsedObj = JSON.parse(data);

    //Set the loglevel first so the rest of the parsing displays the correct errors
    this.logLevel = getValueDef(parsedObj.logLevel, 'ERROR', 'logLevel')
    logger.setLogLevel(this.logLevel)

    this.port = getValueDef(parsedObj.port, this.port, 'port')
    this.tlsSupport = getValueDef(parsedObj.tlsSupport, this.tlsSupport, 'tlsSupport')
    this.certPath = getValueDef(parsedObj.tlsSupport, this.certPath, 'certPath')
    this.logPath = getValueDef(parsedObj.logPath, this.logPath, 'logPath')
    this.includeConfigs = getValueDef(parsedObj.includeConfigs, [], 'includeConfigs')
    this.repositories = getValueDef(parsedObj.repositories, [], 'repositories')
    this.repositories.forEach(repo => {
      validateRepository(repo)
    })
    this.repositories.push(...parseIncludeFiles(this.includeConfigs))
    resolve()
  }
}
export default config