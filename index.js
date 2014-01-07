var Config = require('./lib/config'),
  LoggerFactory = require('./lib/logger'),
  path  = require('path'),
  promises = require('./lib/promises'),
  Scatter = require('scatter');

function ParticlesApp(options) {
  this.options = options || {};
  this.config = new Config();
  this.config.initialize(this.options.config);
  this.running = false;
  
  this.loggerFactory = new LoggerFactory(this.config);

  this.defaultLogger = this.loggerFactory.create();
  this.scatterLogger = this.loggerFactory.create("scatter");
  
  var self = this;
  this.scatter = new Scatter({
    log: self.scatterLogger.log.bind(this.scatterLogger),
    startProfiling: self.scatterLogger.startProfiling.bind(this.scatterLogger)
  });

  //register core modules
  this.scatter.registerModuleInstance('config', this.config);
  this.scatter.registerModuleInstance('logger', this.loggerFactory.create.bind(this.loggerFactory));
  this.scatter.registerModuleInstance('log', this.defaultLogger);
  this.scatter.registerModuleInstance('utils/promises', promises);
  
  var containerName = this.config.get('container') || 'default';
  this.scatter.registerParticles(this.config.get(['containers', containerName, 'particles']));
  
  var nodeModulesDir = this.config.get(containerName + '.nodeModulesDir') || 
      (path.join(this.config.get('appRoot'), 'node_modules'));
  this.scatter.setNodeModulesDir(nodeModulesDir);
}


ParticlesApp.prototype.run = function() {
  if(this.running) {
    self.defaultLogger.warn("Particles app already running");
    return;
  }
  this.running = true;
  var self = this;
  var promise = promises.when(this.options.beforeServices && this.options.beforeServices(this));
  
  var runService = this.options.runService || 'svc|sequence!app_start';

  return self.scatter.load(runService).then(function(svc) {
    return svc.apply(null, self.options.serviceArgs || []);
  })
  .then(function(res) {
    self.defaultLogger.info("Particles app started!");
    return res;
  })
  .otherwise(function(err) {
    self.defaultLogger.error({err: err}, "Failed to run Particles app");
    throw err;
  });
};


module.exports = ParticlesApp;

