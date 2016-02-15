'use strict';
const http = require('http');
const url = require('url');
const net = require('net');
const request = require('request');
const socksClient = require('socks5-client');
const socksHttpAgent = require ('socks5-http-client/lib/Agent');

let _port;

class Proxy {

    constructor(options) {
        this.port = options.port;
        this.onServerError = options.onServerError || () => {};
        this.onBeforeRequest = options.onBeforeRequest || () => {};
        this.onBeforeResponse = options.onBeforeResponse || () => {};
        this.onRequestError = options.onRequestError || () => {};
    }

    requestHandler(req, res) {

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
                    encoding: null
                };

                if(reqBody.length) {
                    requestOptions.body = reqBody;
                }

                console.log(`requestHandler: http: ${req.headers.host}`);

                //若访问的是本proxy，给一个提示
                if (requestOptions.host == '127.0.0.1' && requestOptions.port == _port) {
                    res.writeHead(200, {
                        'Content-Type': 'text/plain'
                    });
                    res.write('proxy works ok');
                    res.end();
                    return;
                }

                if(1) {
                    requestOptions.agentClass = socksHttpAgent;
                    requestOptions.agentOptions = {
                        socksHost: '127.0.0.1',
                        socksPort: 1080
                    }
                }

                request(requestOptions, function (error, response, body) {
                    
                    res.writeHead(response.statusCode, response.headers);
                    res.end(body);

                });

                /*
                let agent = new Agent(requestOptions, 'http');
                requestOptions.agent = agent;
                
                sendRequest(requestOptions, req, res);
                */
            });

        } catch (e) {
            console.log(`requestHandlerError': ${e.message}`);
        }

    }

    connectHandler(req, socket, head) {
        try {
            delete req.headers['proxy-connection'];
            req.headers['connection'] = 'close';
            let rUrl = url.parse(`https://${req.url}`);

            console.log(`connectHandler: ${rUrl.hostname}`);

            //this.emit('beforeRequest', requestOptions);
            let tunnel;
            if(1) {
                tunnel = socksClient.createConnection({
                    socksHost: '127.0.0.1',
                    socksPort: 1080,
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
                throw new Error(e);
            });
            tunnel.on('error', (e) => {
                socket.destroy();
                throw new Error(e);
            });
            socket.on('timeout', (e) => {
                tunnel.destroy();
                socket.destroy();
            });
            tunnel.on('timeout', (e) => {
                socket.destroy();
                tunnel.destroy();
            });

        } catch (e) {
            console.log(`connectHandler error: ${e.message}`);
        }

    }

    start() {

        let server = http.createServer();

        server.on('request', this.requestHandler);
        server.on('connect', this.connectHandler);

        server.on('error', this.onServerError);
        server.on('beforeRequest', this.onBeforeRequest);
        server.on('beforeResponse', this.onBeforeResponse);
        server.on('requestError', this.onRequestError);

        server.listen(this.port);
        _port = this.port;
    }
}

module.exports = Proxy;