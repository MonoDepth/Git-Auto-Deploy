import koa from 'koa'
import Router from 'koa-router'
import koaBody from 'koa-body'
import configuration from './common/configuration.js'
import logger from './common/logger.js'
import { handleEvent } from './api.js'
import process from 'node:process'

try {
  logger.setLogLevel('WARNING')
  const config = new configuration()
  await config.load()
  const app = new koa()
  const router = new Router()

  router.prefix('/api')
  router.get('/test')
  router.post('/event', handleEvent)

  app
  .use(async (ctx, next) => {
    ctx.state.config = config
    await next()
  })
  .use(new koaBody())
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(config.port)

  logger.log(`Running on port ${config.port}`)
}
catch(ex) {
  logger.error(ex)
  process.exitCode = 1;
}