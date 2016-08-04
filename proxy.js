'use strict';
const http = require('http');
const url = require('url');
const net = require('net');
const request = require('request');
const socksClient = require('socks5-client');
const socksHttpAgent = require ('socks5-http-client/lib/Agent');

let _self;

class Proxy {

    constructor(options) {
        this.port = options.port;
        this.agent = options.agent;
        this.mock = options.mock || null;
        this.onServerError = options.onServerError || (() => {});
        this.onBeforeRequest = options.onBeforeRequest || (() => {});
        this.onBeforeResponse = options.onBeforeResponse || (() => {});
        this.onRequestError = options.onRequestError || (() => {});
    }

    requestHandler(req, res) {
        let self = this;
        try {
            delete req.headers['proxy-connection'];
            req.headers['connection'] = 'close';
            let path = req.headers.path || url.parse(req.url).path;
            let reqBody = [];

            req.on('data', (chunk) => {
                reqBody.push(chunk);
            });
            req.on('end', () => {

                let requestOptions = {
                    host: req.headers.host.split(':')[0],
                    port: req.headers.host.split(':')[1] || 80,
                    url: req.url,
                    path: path,
                    method: req.method,
                    headers: req.headers,
                    encoding: null,
                    followRedirect: false
                };

                if(reqBody.length) {
                    requestOptions.body = reqBody;
                }

                console.log(`HTTP ${req.method}: ${req.url}`);

                //若访问的是本proxy，给一个提示
                if (requestOptions.host == '127.0.0.1' && requestOptions.port == this.port) {
                    res.writeHead(200, {
                        'Content-Type': 'text/plain'
                    });
                    res.write('proxy works ok');
                    res.end();
                    return;
                }

                if(_self.agent.type === 'socks5') {
                    requestOptions.agentClass = socksHttpAgent;
                    requestOptions.agentOptions = {
                        socksHost: _self.agent.host,
                        socksPort: _self.agent.port
                    };
                }

                self.emit('beforeRequest', requestOptions);

                if(_self.mock) {
                    _self.mock(req, res, requestOptions);
                } else {
                    request(requestOptions, function (error, response, body) {
                        if(error) {
                            self.emit('requestError', error);
                            console.log(error);
                        }
                        try {
                            self.emit('beforeResponse', response, body);
                            res.writeHead(response.statusCode, '', response.headers);
                            res.end(body);
                        }catch(e) {
                            console.log(e);
                        }

                    });
                }
            });

        } catch (e) {
            self.emit('error', e);
            console.log(`requestHandlerError': ${e.message}`);
        }

    }

    connectHandler(req, socket, head) {
        try {
            delete req.headers['proxy-connection'];
            req.headers['connection'] = 'close';
            let rUrl = url.parse(`https://${req.url}`);

            console.log(`connectHandler: ${rUrl.hostname}`);

            let tunnel;
            if(_self.agent.type === 'socks5') {
                tunnel = socksClient.createConnection({
                    socksHost: _self.agent.host,
                    socksPort: _self.agent.port,
                    host: rUrl.hostname,
                    port: rUrl.port
                });
                tunnel.on('connect', () => {
                    socket.write('HTTP/1.1 200 Connection Established\r\nConnection: close\r\n\r\n');
                    tunnel.write(head);
                });
                socket.on('data', (data) => {
                    tunnel.write(data);
                });
                tunnel.on('data', (data) => {
                    socket.write(data);
                });
            }else {
                tunnel = net.connect(rUrl.port, rUrl.hostname, () => {
                    socket.write('HTTP/1.1 200 Connection Established\r\nConnection: close\r\n\r\n');
                    tunnel.write(head);
                    socket.pipe(tunnel);
                    tunnel.pipe(socket);
                });
            }

            socket.on('end', () => {
                tunnel.end();
            });
            tunnel.on('end', () => {
                socket.end();
            });
            socket.on('error', (e) => {
                tunnel.destroy();
                console.log(e);
            });
            tunnel.on('error', (e) => {
                socket.destroy();
                console.log(e);
            });
            socket.on('timeout', (e) => {
                console.log(e);
                tunnel.destroy();
                socket.destroy();
            });
            tunnel.on('timeout', (e) => {
                console.log(e);
                socket.destroy();
                tunnel.destroy();
            });

        } catch (e) {
            console.log(`connectHandler error: ${e.message}`);
        }

    }

    start() {
        let server = http.createServer();
        _self = this;
        server.on('request', this.requestHandler);
        server.on('connect', this.connectHandler);

        server.on('error', this.onServerError);
        server.on('beforeRequest', this.onBeforeRequest);
        server.on('beforeResponse', this.onBeforeResponse);
        server.on('requestError', this.onRequestError);

        server.listen(this.port);
    }
}

module.exports = Proxy;