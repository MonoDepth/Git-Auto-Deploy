import { exec } from 'child_process'
import logger from './logger.js'

export const execAsync = async (command, options) => {
  logger.debug(`Running command ${command}`)
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(stderr !== '' ? stderr : stdout)
      }
      resolve(stdout)
    })
  })
}
