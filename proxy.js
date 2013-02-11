var proxy = require('http-proxy'),
    net   = require('net'),
    url   = require('url');

function Host(string) {
  var parts = string.split(':');
  this.name = parts[0];
  this.port = parseInt(parts[1] || 80);
}

Host.prototype = {
  toOptions : function() {
    return { host: this.name, hostname: this.name, port: this.port }
  }
}

function Auth(string) {
  var parts = ((typeof string) == 'string' ? string.split(" ") : [ ]);

  this.method = parts[0];
  this.key    = parts[1];
}

Auth.prototype = {
  isBasic: function() {
    return (this.method == 'Basic');
  }
}

Auth.basicCredentials = function() {
  return [
    process.env['PROXY_USERNAME'],
    process.env['PROXY_PASSWORD']
  ];
}

Auth.basicEncodedCredentials = function() {
  return (new Buffer(Auth.basicCredentials().join(':'))).toString("base64");
}

Auth.authenticate = function(req, res, callback) {

  var auth = new this(req.headers['proxy-authorization']);

  if(auth.isBasic()) {
    if(this.basicEncodedCredentials() == auth.key) {
      delete req.headers['proxy-authorization'];
      callback();
    }
  }
  else {
    res.writeHead(407, { 'Proxy-Authenticate' : 'Basic realm=Private' })
    res.end();
  }
}

function proxyHttp(req, res, proxy) {
  Auth.authenticate(req, res, function() {
    req.url = url.parse(req.url).path;
    proxy.proxyRequest(req, res, (new Host(req.headers.host)).toOptions());
  });
}

function proxyHttps(req, source, head) {

  var dest = net.connect((new Host(req.url)).toOptions());

  dest.on('connect', function() {
    source.write(
      "HTTP/1.1 200 Connection established\r\n" +
      "\r\n"
    );
    dest.write(head);
  });

  dest.on('data', function(data) {
    source.write(data);
  });

  source.on('data', function(data) {
    dest.write(data);
  });

  dest.on('error', function() {
    source.end();
  });
}

var opts = {
  enable: {
    xforward: false
  }
}

proxy.createServer(opts, proxyHttp).on('connect', proxyHttps).listen(process.env['PORT']);

console.log("Proxy running on port", process.env['PORT']);

