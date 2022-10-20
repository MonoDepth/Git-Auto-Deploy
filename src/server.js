import koa from 'koa'
import Router from 'koa-router'
import koaBody from 'koa-body'
import configuration from './common/configuration.js'
import logger from './common/logger.js'
import { handleEvent } from './api.js'
import process from 'node:process'

try {
  //Default loglevel to highest while we parse the settings and actual loglevel to not miss out on any errors
  logger.setLogLevel('DEBUG')
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

  logger.info(`Running on port ${config.port}`)
}
catch(ex) {
  logger.error(ex)
  process.exitCode = 1;
}