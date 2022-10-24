import logger from "./common/logger.js"
import { createHmac, randomUUID } from 'node:crypto'
import { execAsync } from "./common/utils.js"
import messageHandler from "./common/messageHandler.js"


const escapeRegex = (str) => {
  const res = str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return res.replace('\\*', '.*')
}

const verifyRequest = (eventType, uuid, body) => {
  const eventTypes = ['ping', 'push', 'release', 'custom-upload']
  if (!eventType || !eventTypes.includes(eventType)) {
    logger.debug(`event type ${eventType} not supported, skipping... (${uuid})`)
    return `event type ${eventType} not supported`
  }

  if (!body) {
    logger.debug(`No body supplied for request (${uuid})`)
  }  

  //Check at least some basic body tags
  if (eventType != 'custom-upload' && !(body.repository && body.repository.url && body.repository.full_name)) {
    logger.debug(`Invalid body (${uuid})`)
    return 'Invalid body'
  }

  return ''
}

const matchingTrigger = (pushEvent, refName, trigger) => {
  const regEx = new RegExp(`refs\/(tags|heads)\/${escapeRegex(trigger.identifier)}`)
  return trigger.type === pushEvent && (
    trigger.identifier === '*' ||
    regEx.test(refName)
  )
}

// Fetch all changes from the remote
// Forcefully checkout the commit hash and all the submodules as a detached head
const prepareRepo = async (repo, commitHash) => {
  try {    
    await execAsync(`git fetch -p ${repo.remote}`, {cwd: repo.projectRoot, env: {GIT_SSH_COMMAND: `ssh -i ${repo.privateKeyFile.replace(/\\/g, '/')}`}})
    await execAsync(`git checkout -q -f -d --recurse-submodules ${commitHash}`, {cwd: repo.projectRoot})
  } catch (ex) {
    return ex
  }
  return ''
}

// Loop through each deployment trigger, run the deployment script and call the webhooks
const handleDeploy = async (repoName, repo, triggers) => {
  const deployments = []  

  triggers.forEach(trigger => {
    deployments.push((async () => {      
      const msgSenders = []
      trigger.statusCallback.forEach(callback => {
        msgSenders.push(new messageHandler(callback.service, callback.webhook))
      }) 
      try {               
        await execAsync(`"${trigger.deploy}"`,{ cwd: repo.projectRoot, env: {...trigger.environmentVars}})
        msgSenders.forEach(async sender => await sender.sendMessage(`Deployment of ${repoName} successful`, `Trigger: ${trigger.type} - ${trigger.identifier}`, '3066993'))
      } catch (stderr) {
        msgSenders.forEach(async sender => await sender.sendMessage(`Deployment of ${repoName} failed`, `Trigger: ${trigger.type}: ${trigger.identifier}`, '15158332'))
      }
    }).call())
  })
  return ''
  // TODO: Wait for and log? (REST call from Github will probably timeout if we do that)
  try {
    await Promise.all(deployments)
  }
  catch(ex) {
    return ex
  }
  return ''
}

// Check the HMAC signature supplied by github
const verifySignature = (signature, secret, body, repoUrl) => {
  if (secret != '') {
    if (!signature) {
      logger.debug(`No signature supplied for ${repoUrl} in http call`)
      return false
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    const wanted = `sha256=${hmac.digest('hex')}`
    if (wanted != signature) {
      logger.warn(`HMAC does not match for ${repoUrl} Expecting ${wanted} got ${signature}`)
      return false
    }
  }
  return true
}

//Main entrypoint for the webhook
export const handleEvent = async (ctx) => {
  const eventType = ctx.get('X-GitHub-Event')
  let deliveryGuid = ctx.get('X-GitHub-Delivery')
  const signature = ctx.get('X-Hub-Signature-256')
  const data = ctx.request.body

  if (!deliveryGuid) {
    logger.debug('No guid supplied, generating one...')
    deliveryGuid = randomUUID()
  }
  
  logger.debug(`Got delivery with guid ${deliveryGuid}`)

  const verificationError = verifyRequest(eventType, deliveryGuid, data)
  if (verificationError != '') {
    ctx.status = 400
    ctx.body = verificationError
  }

  const matchingRepos = ctx.state.config.repositories.filter(x => x.url.toUpperCase() === data.repository.ssh_url.toUpperCase())

  if (!matchingRepos.length === 0) {
    ctx.status = 200
    logger.debug(`Unkown repo ${data.repository.full_name}, skipping... (${deliveryGuid})`)
    return
  }

   for (let key in matchingRepos) {
    const repo = matchingRepos[key]
    if (!verifySignature(signature, repo.secret, data, repo.url)) {
      ctx.status = 400      
      ctx.body = `HMAC Check failed for ${repo.url}`
      return
    }
  }

  logger.debug(`Pre-checks OK (${deliveryGuid})`)

  switch (eventType) {
    case 'ping':
    default:
      ctx.body = 'pong'
      logger.info(`Got ping from ${data.repository.full_name}`)
      break;
    case 'push':
      if (data.deleted) {
        console.debug(`Skipping deletion push on ${data.repository.full_name}`)
        return
      }
      const ref = data.ref      
      logger.debug(`Got push to ${ref} on ${data.repository.full_name}`)      

      let triggerType = ''
      if (ref.startsWith('refs/tags/')) {
        triggerType = 'push-tag'
      } else if (ref.startsWith('refs/heads/')) {
        triggerType = 'push-commit'
      }

      if (triggerType === '') {
        logger.debug(`Invalid ref ${ref} (${deliveryGuid})`)
        ctx.status = 400
        ctx.body = `Invalid ref ${ref}`
        return
      }      

      for (const repo of matchingRepos) {

        const triggers = repo.triggers.filter(trigger => matchingTrigger(triggerType, ref, trigger))
        if (triggers.length === 0) {
          logger.debug(`No matching triggers found (${deliveryGuid})`)
          ctx.status = 200
          continue
        }

        let result = await prepareRepo(repo, data.head_commit.id ?? ref)      
        if (result !== '') {
          ctx.status = 500
          ctx.body = result
          return
        }

        result = await handleDeploy(data.repository.full_name, repo, triggers)        
      }      
      ctx.status = 200
  }  
}