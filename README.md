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

```javascript
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

let mock = (req, res, requestOptions) => {  //req:原始请求 res:回送数据 requestOptions:处理后的req，可以直接用于request库
    console.log(`MOCK ${req.method}: ${req.url}`);
    res.writeHead(result.statusCode, '', result.headers); //自己的mock数据...
    res.end(result.body);
};
```

### license

MIT

### 致谢
[mini-proxy](https://github.com/liyangready/mini-proxy)