import { exec } from 'child_process'

export const execAsync = async (command, options) => {
  return new Promise((resolve, reject) => {
  exec(command, {windowsHide: true, ...options}, (error, stdout, stderr) => {
      if (error) {
        reject(stderr)
      }
      resolve(stdout)
    })
  })
}