
var url = require('url')
var qs = require('qs')

var express = require('express')
var session = require('express-session')
var cookiesession = require('cookie-session')
var bodyParser = require('body-parser')

var Koa = require('koa')
var koasession = require('koa-session')
var koabody = require('koa-bodyparser')
var mount = require('koa-mount')
var convert = require('koa-convert')
var koaqs = require('koa-qs')

var Hapi = require('hapi')
var yar = require('yar')

var Grant = require('../../../')

var _Koa = Koa
Koa = function () {
  var version = parseInt(require('koa/package.json').version.split('.')[0])

  var app = new _Koa()

  if (version >= 2) {
    var _use = app.use
    app.use = (mw) => _use.call(app, convert(mw))
  }

  return app
}

module.exports = {
  express: (config, port) => new Promise((resolve) => {
    var grant = Grant.express()(config)

    var app = express()
    app.use(bodyParser.urlencoded({extended: true}))
    app.use(session({secret: 'grant', saveUninitialized: true, resave: false}))
    app.use(grant)
    app.get('/', callback.express)

    var server = app.listen(port, () => resolve({grant, server, app}))
  }),
  'express-cookie': (config, port) => new Promise((resolve) => {
    var grant = Grant.express()(config)

    var app = express()
    app.use(bodyParser.urlencoded({extended: true}))
    app.use(cookiesession({signed: true, secret: 'grant', maxAge: 60 * 1000}))
    app.use(grant)
    app.get('/', callback.express)

    var server = app.listen(port, () => resolve({grant, server, app}))
  }),
  koa: (config, port) => new Promise((resolve) => {
    var grant = Grant.koa()(config)

    var app = new Koa()
    app.keys = ['grant']
    app.use(koasession(app))
    app.use(koabody())
    app.use(grant)
    koaqs(app)
    app.use(callback.koa)

    var server = app.listen(port, () => resolve({grant, server, app}))
  }),
  'koa-mount': (config, port) => new Promise((resolve) => {
    var grant = Grant.koa()(config)

    var app = new Koa()
    app.keys = ['grant']
    app.use(koasession(app))
    app.use(koabody())
    app.use(mount(grant))
    koaqs(app)
    app.use(callback.koa)

    var server = app.listen(port, () => resolve({grant, server, app}))
  }),
  hapi: (config, port) => new Promise((resolve) => {
    var grant = Grant.hapi()(config)

    var server = new Hapi.Server()
    server.connection({host: 'localhost', port})
    server.route({method: 'GET', path: '/', handler: callback.hapi})

    server.register([
      {register: grant},
      {register: yar, options: {cookieOptions:
        {password: '01234567890123456789012345678912', isSecure: false}}}
    ],
    () => server.start(() => resolve({grant, server})))
  }),
  hapi17: (config, port) => new Promise((resolve) => {
    var grant = Grant.hapi()(config)

    var server = new Hapi.Server({host: 'localhost', port})
    server.route({method: 'GET', path: '/', handler: callback.hapi17})

    server.register([
      {plugin: grant},
      {plugin: yar, options: {cookieOptions:
        {password: '01234567890123456789012345678912', isSecure: false}}}
    ])
    .then(() => server.start().then(() => resolve({grant, server})))
  }),
}

var callback = {
  express: (req, res) => {
    res.writeHead(200, {'content-type': 'application/json'})
    res.end(JSON.stringify({
      session: req.session.grant,
      response: req.session.grant.response || req.query,
    }))
  },
  koa: function* () {
    if (this.path === '/') {
      this.response.status = 200
      this.set('content-type', 'application/json')
      this.body = JSON.stringify({
        session: this.session.grant,
        response: this.session.grant.response || this.request.query,
      })
    }
  },
  hapi: (req, res) => {
    var parsed = url.parse(req.url, false)
    var query = qs.parse(parsed.query)
    res({
      session: (req.session || req.yar).get('grant'),
      response: (req.session || req.yar).get('grant').response || query
    })
  },
  hapi17: (req, res) => {
    var query = qs.parse(req.query)
    return res.response({
      session: req.yar.get('grant'),
      response: req.yar.get('grant').response || query,
    })
  }
}
