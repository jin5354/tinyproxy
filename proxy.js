'use strict';
const http = require('http');
const url = require('url');
const net = require('net');

let port;

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
            
            let path = req.headers.path || url.parse(req.url).path;
            let requestOptions = {
                host: req.headers.host.split(':')[0],
                port: req.headers.host.split(':')[1] || 80,
                path: path,
                method: req.method,
                headers: req.headers
            };

            console.log(requestOptions.host+requestOptions.path);

            //若访问的是本proxy，给一个提示
            if (requestOptions.host == '127.0.0.1' && requestOptions.port == port) {
                res.writeHead(200, {
                    'Content-Type': 'text/plain'
                });
                res.write('proxy works ok');
                res.end();
                return;
            }

            sendRequest(requestOptions, req, res);

        } catch (e) {
            //console.log('requestHandlerError' + e.message);
        }

    }

    connectHandler(req, socket, head) {
        try {

            let requestOptions = {
                host: req.url.split(':')[0],
                port: req.url.split(':')[1] || 443
            };

            let ontargeterror = () => {

                _synReply(socket, 502, 'Tunnel Error', {}, function() {
                    try {
                        socket.end();
                    }
                    catch(e) {
                        console.log(`end error: ${e.message}`);
                    }

                });
            };

            let connectRemote = (requestOptions, socket) => {
                let tunnel = net.createConnection(requestOptions, function() {
                    //format http protocol
                    _synReply(socket, 200, 'Connection established', {
                        'Connection': 'keep-alive'
                    }, function(e) {
                        if (e) {
                            console.log(`syn error: ${e.message}`);
                            tunnel.end();
                            socket.end();
                            return;
                        }
                        tunnel.pipe(socket);
                        socket.pipe(tunnel);
                    });
                });

                tunnel.setNoDelay(true);
                tunnel.on('error', ontargeterror);
            };

            this.emit('beforeRequest', requestOptions);
            connectRemote(requestOptions, socket);
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
        port = this.port;
    }
}

let sendRequest = (requestOptions, req, res) => {
    let rReq = http.request(requestOptions, function(rRes) {

        // write out headers to handle redirects
        res.writeHead(rRes.statusCode, '', rRes.headers);

        rRes.pipe(res);
        res.pipe(rRes);

    });

    rReq.on('error', function() {

        res.writeHead(502, 'Proxy fetch failed');
    });

    req.pipe(rReq);

    res.on('close', function() {
        rReq.abort();
    });
};

let _synReply = (socket, code, reason, headers, cb) => {
    try {
        let statusLine = 'HTTP/1.1 ' + code + ' ' + reason + '\r\n';
        let headerLines = '';
        for (var key in headers) {
            headerLines += key + ': ' + headers[key] + '\r\n';
        }
        socket.write(statusLine + headerLines + '\r\n', 'UTF-8', cb);
    } catch (error) {
        cb(error);
    }
};

module.exports = Proxy;