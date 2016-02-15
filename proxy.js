'use strict';
const http = require('http');
const url = require('url');
const net = require('net');
const tls = require('tls');
const request = require('request');
const socksClient = require('socks5-client');

let _port;

class Agent extends http.Agent {

    constructor(options, protocol) {
        super(options);
        this.socksHost = options.socksHost || 'localhost';
        this.socksPort = options.socksPort || 1080;
        if(protocol === 'http') {
            this.createConnection = socksClient.createConnection;
        }else if(protocol === 'https') {
            this.defaultPort = 443;
            this.protocol = 'https:';
            this.createConnection = createConnection;
        }
    }

}

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
            let path = req.headers.path || url.parse(req.url).path;

            let requestOptions = {
                host: req.headers.host.split(':')[0],
                port: req.headers.host.split(':')[1] || 80,
                path: path,
                method: req.method,
                headers: req.headers
            };

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

            let agent = new Agent(requestOptions, 'http');
            requestOptions.agent = agent;

            sendRequest(requestOptions, req, res);

        } catch (e) {
            console.log(`requestHandlerError': ${e.message}`);
        }

    }

    connectHandler(req, socket, head) {
        try {

            let requestOptions = {
                host: req.url.split(':')[0],
                port: req.url.split(':')[1] || 443
            };

            console.log(`connectHandler: https: ${req.headers.host}`);

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

            let agent = new Agent(requestOptions, 'https');
            requestOptions.agent = agent;

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
        _port = this.port;
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

let createConnection =(options) => {

    let socksSocket, handleSocksConnectToHost;

    socksSocket = socksClient.createConnection(options);

    handleSocksConnectToHost = socksSocket.handleSocksConnectToHost;
    socksSocket.handleSocksConnectToHost = function() {
        options.socket = socksSocket.socket;
        options.servername = options.hostname;

        socksSocket.socket = tls.connect(options, function() {

            // Set the 'authorized flag for clients that check it.
            socksSocket.authorized = socksSocket.socket.authorized;
            handleSocksConnectToHost.call(socksSocket);
        });

        socksSocket.socket.on('error', function(err) {
            socksSocket.emit('error', err);
        });
    };

    return socksSocket;
};

module.exports = Proxy;