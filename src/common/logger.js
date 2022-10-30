const Logger = class {
  static level = 4
  static error = (message) => {
    if (this.level >= 4) {
      console.error(`[ERROR] ${message}`)
    }
  }

  static warn = (message) => {
    if (this.level >= 2) {
      console.log(`[WARN] ${message}`)
    }
  }

  static info = (message) => {
    if (this.level >= 3) {
      console.log(`[INFO] ${message}`)
    }
  }

  static debug = (message) => {
    if (this.level >= 4) {
      console.log(`[DEBUG] ${message}`)
    }
  }

  static log = (message) => {
    console.log(message)
  }

  static setLogLevel = (logLevelString) => {
    this.level = this.convertLogLevel(logLevelString)
  }

  static convertLogLevel = (logLevelString) => {
    switch (logLevelString.toUpperCase()) {
      case 'DEBUG':
        return 4
      case 'INFO':
        return 3
      case 'WARNING':
        return 2
      case 'ERROR':
      default:
        return 1
    }
  }
}

export default Logger
