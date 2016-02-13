'use strict';
const http = require('http');
const url = require('url');
//const request = require('request');

let port;

function Proxy() {
    this.port = 12222;
    this.onServerError = function() {};
    this.onBeforeRequest = function() {
        //_webContents.send('HTTPData', 'req', req);
    };
    this.onBeforeResponse = function() {
        //_webContents.send('HTTPData', 'res', res);
    };
    this.onRequestError = function() {};
}

Proxy.prototype.requestHandler = (req, res) => {

    try {
        
        var self = this; // this -> server
        var path = req.headers.path || url.parse(req.url).path;
        var requestOptions = {
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
        console.log('requestHandlerError' + e.message);
    }

};

Proxy.prototype.start = function() {

    let server = http.createServer();

    server.on('request', this.requestHandler);
    //server.on('connect', this.connectHandler);

    server.on('error', this.onServerError);
    server.on('beforeRequest', this.onBeforeRequest);
    server.on('beforeResponse', this.onBeforeResponse);
    server.on('requestError', this.onRequestError);

    server.listen(this.port);
    port = this.port;
};

let sendRequest = (requestOptions, req, res) => {
    let rReq = http.request(requestOptions, function(rRes) {

        // write out headers to handle redirects
        res.writeHead(rRes.statusCode, '', rRes.headers);

        rRes.pipe(res);
        // Res could not write, but it could close connection
        res.pipe(rRes);

    });

    rReq.on('error', function(e) {
        console.log('requestError', e, req, res);

        res.writeHead(502, 'Proxy fetch failed');
//            res.end();
//            remoteRequest.end();
    });

    req.pipe(rReq);

    res.on('close', function() {
        rReq.abort();
    });
};

let tinyProxy = new Proxy();
tinyProxy.start();