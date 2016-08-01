### tinyproxy

支持http、https的透明转发代理，支持抓包改包，目前支持socks5的二次转发。

### 使用

```javascript
let proxy = new tinyProxy({
    port: 9999,
    agent: 'http'
});

proxy.start();
console.log(`proxy started! Listening on port 9999.`);
```

可配置项：

```json
{
    port: 9999,
    agent: 'http',
    mock: mock,  //是否启用mock模式
    onServerError: function(){},
    onBeforeRequest: function(){},
    onBeforeResponse: function(){},
    onRequestError: function(){}
}


//mock 处理函数

let mock = (req, res, response, body) => {  //req:原始请求 res:回送数据 response:接收数据 body:接收数据body
    console.log(`MOCK ${req.method}: ${req.url}`);
    res.writeHead(response.statusCode, '', result.headers);
    res.end(result.body);
};
```

### 致谢
[mini-proxy](https://github.com/liyangready/mini-proxy)