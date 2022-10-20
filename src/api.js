import logger from "./common/logger.js"
import { createHmac, randomUUID } from 'node:crypto'

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
  const regEx = new RegExp(`refs\/(tags|head)\/${escapeRegex(trigger.identifier)}`)
  return trigger.type === pushEvent && (
    trigger.identifier === '*' ||
    regEx.test(refName)
  )
}

const handleDeploy = (triggers) => {

}

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

export const handleEvent = (ctx) => {
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

      if (triggerType = '') {
        logger.debug(`Invalid ref ${ref} (${deliveryGuid})`)
        ctx.status = 400
        ctx.body = `Invalid ref ${ref}`
      }

      matchingRepos.forEach(repo => {
        const triggers = repo.triggers.filter(trigger => matchingTrigger(triggerType, ref, trigger))
        handleDeploy(triggers)
      });
      ctx.status = 200
  }  
}