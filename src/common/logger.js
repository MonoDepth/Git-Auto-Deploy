import winston from 'winston'

const logger = class {
  _logger = null
  static createLogger = (logLevel, logFile) => {
    this._logger = winston.createLogger({
      level: this.convertLogLevel(logLevel),
      format: winston.format.simple(),
      transports: [
        new winston.transports.Console()
      ]
    })

    if (logFile !== '') {
      this.addLogFile(logFile)
    }
  }

  static error = (message) => {
    this._logger.error(message)
  }

  static warn = (message) => {
    this._logger.warn(message)
  }

  static info = (message) => {
    this._logger.info(message)
  }

  static debug = (message) => {
    this._logger.debug(message)
  }

  static log = (message) => {
    this._logger.info(message)
  }

  static setLogLevel = (logLevelString) => {
    this._logger.level = this.convertLogLevel(logLevelString)
  }

  static addLogFile = (logFile) => {
    this._logger.add(new winston.transports.File({ filename: logFile, maxFiles: 5, maxsize: 10000000, tailable: true, zippedArchive: true }))
  }

  static convertLogLevel = (logLevelString) => {
    switch (logLevelString.toUpperCase()) {
      case 'DEBUG':
        return 'debug'
      case 'INFO':
        return 'info'
      case 'WARNING':
        return 'warning'
      case 'ERROR':
      default:
        return 'error'
    }
  }
}

export default logger
