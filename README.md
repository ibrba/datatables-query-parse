# datatablesQueryParse

datatablesQueryParse is a module for making the integration between front-end tables using
[datatables](https://www.datatables.net/) and a serverless Parse Server backend easier.

The main purpose is dealing with server side processing available in datatables, making it easy to integrate client and
server.

## Getting Started

Install the module.

```
npm install datatables-query-parse
```

In your front-end, configure your DataTable to use serverSide processing and Ajax. The request type MUST be 'POST'.

```javascript
// jQuery way
$('#example').DataTable( {
    serverSide: true,
    ajax: {
        url: '/path/to/api/endpoint',
        type: 'POST'
    }
} );
```


```javascript
// Angular way - @see https://l-lin.github.io/angular-datatables/#/serverSideProcessing for full example

vm.dtOptions = DTOptionsBuilder.newOptions()
    .withOptions('serverSide', true)
    .withOptions('ajax', {
        url: '/path/to/api/endpoint',
        type: 'POST'
    })
    .// all other options



The DataTables params will get caught in the request body. It should be passed to the run method, which will return a
promise.

```javascript

app.post('/path/to/api/endpoint', function (req, res) {
        var ModelName = "MyModel",
        datatablesQuery = require('datatables-query-parse'),
        params = req.body,
        query = datatablesQuery(ModelName);

    query.run(params).then(function (data) {
        res.json(data);
    }, function (err) {
        res.status(500).json(err);
    });
};
```

That's all folks. Your table should be working just fine.

## License

The MIT License (MIT)

Copyright (c) 2018 Ibrahima BA ibrba91@gmail.com
