import Koa from 'koa'
import Router from 'koa-router'
import KoaBody from 'koa-body'
import Configuration from './common/configuration.js'
import logger from './common/logger.js'
import { eventController } from './eventController.js'
import process from 'node:process'

try {
  logger.createLogger('warning', '')
  const config = new Configuration()
  await config.load()
  const app = new Koa()
  const router = new Router()

  router.prefix('/api')
  router.get('/test')
  router.post('/event', eventController)

  app
    .use(async (ctx, next) => {
      ctx.state.config = config
      await next()
    })
    .use(new KoaBody())
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(config.port)

  logger.log(`Running on port ${config.port}`)
} catch (ex) {
  logger.error(ex)
  process.exitCode = 1
}
