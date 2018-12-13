'use strict';

var async = require('async'),

    /**
     * Method parseRequest
     * Builds a JSON Object from not good formatted Datatables params
     * - If  we have in input this:
     * ```
                { draw: '1',
                'columns[0][data]': 'id',
                'columns[0][name]': '',
                'columns[0][searchable]': 'true',
                'columns[0][orderable]': 'true',
                'columns[0][search][value]': '',
                'columns[0][search][regex]': 'false',
                'columns[1][data]': 'name',
                'columns[1][name]': '',
                'columns[1][searchable]': 'true',
                'columns[1][orderable]': 'true',
                'columns[1][search][value]': '',
                'columns[1][search][regex]': 'false',
                'order[0][column]': '0',
                'order[0][dir]': 'asc',
                 start: '0',
                 length: '2',
                'search[value]': '',
                'search[regex]': 'false' }
     * ```
     *  - The output will be : 
      * ```
      *  { draw: '1',
            start: '0',
            length: '2',
            columns:
                    [ { 
                        data: 'id',
                        name: '',
                        searchable: 'true',
                        orderable: 'true',
                        search: { value: '', regex: 'false' }  
                        },
                        { 
                        data: 'name',
                        name: '',
                        searchable: 'true',
                        orderable: 'true',
                        search: { value: '', regex: 'false' } 
                        }
                    ],
            order: [ { column: '0', dir: 'asc' } ],
            search: { value: '', regex: 'false' } }
     * ```
     * @param params DataTable params that are not object like
     * @returns  {Object} params DataTable params object
     */
    parseRequest = function(params) {
        console.log(params)
        if (!params) {
            return params;
        }

        var keys = Object.keys(params),
            columns = [],
            order = [],
            search = {},
            results ={};
        keys.forEach(key => {
            var regexColumn = /^columns\[([0-9]+)\]\[(.+)\]/;
            var test=  regexColumn.test(key)
            if(test)
            {
                var index  = key.replace(regexColumn, '$1');
                var field  = key.replace(regexColumn, '$2');
                var fields = field.split("][")
                if(!columns[index]) columns[index]= {};
                if(fields && fields.length==2){
                    if(!columns[index][fields[0]]) columns[index][fields[0]] = {}
                    columns[index][fields[0]][fields[1]] = params[key]
                }else{
                    columns[index][field] = params[key]
                }
            }else{
                var regexOrder = /^order\[([0-9]+)\]\[(.+)\]/;
                test=  regexOrder.test(key)
                if(test)
                {
                    var index  = key.replace(regexOrder, '$1');
                    var field  = key.replace(regexOrder, '$2');
                    
                    if(!order[index]) order[index]= {};
                    order[index][field] = params[key]
                }else{
                    var regexSearch = /^search\[(.+)\]/;
                    test=  regexSearch.test(key)
                    if(test)
                    {
                        var field  = key.replace(regexSearch, '$1');
                        search[field] = params[key]
                    } else{
                        results[key] = params[key];
                    }
                } 
            }
        });
        results['columns'] = columns;
        results['order'] = order;
        results['search'] =  search;
        console.log(results)
        return results;

    },

    /**
     * Method getSearchableFields
     * Returns an array of fieldNames based on DataTable params object
     * All columns in params.columns that have .searchable == true field will have the .data param returned in an String
     * array. The .data property is used because in angular frontend DTColumnBuilder.newColumn('str') puts 'str' in the
     * data field, instead of the name field.
     * @param params
     * @returns {Array}
     */
    getSearchableFields = function (params) {
        return params.columns.filter(function (column) {
            return JSON.parse(column.searchable);
        }).map(function (column) {
            return column.data;
        });
    },

    /**
     * Method isNaNorUndefined
     * Checks if any of the passed params is NaN or undefined.
     * Used to check DataTable's properties draw, start and length
     * @returns {boolean}
     */
    isNaNorUndefined = function () {
        var args = Array.prototype.slice.call(arguments);
        return args.some(function (arg) {
            return isNaN(arg) || (!arg && arg !== 0);
        });
    },

    /**
     * Methdd buildFindParameters
     * Builds a find expression based on DataTables param object
     * All search are by regex so the field param.search.regex is ignored.
     * @param params DataTable params object
     * @returns {*}
     */
    buildFindParameters = function (params) {

        if (!params || !params.columns || !params.search || (!params.search.value && params.search.value !== '')) {
            console.log("find Null", params,params.columns)

            return null;
        }

        var searchText = params.search.value,
            findParameters = [],
            searchRegex,
            searchOrArray = [];

        if (searchText === '') {
            return findParameters;
        }

        var searchableFields = getSearchableFields(params);

        if (searchableFields.length === 1) {
            obj = {};
            obj[searchableFields[0]] = searchText
            findParameters.push(obj);
            return findParameters;
        }

        searchableFields.forEach(function (field) {
            var orCondition = {};
            orCondition[field] = searchText;
            searchOrArray.push(orCondition);
        });

        findParameters = searchOrArray;

        return findParameters;
    },

        /**
     * Method orQueries
     * Created an array of Parse queries from the findParameters that we have to do the search
     * @param params
     * @returns {Parse.Query}
     */

    orQueries  =  function(params){
        return params.map(param => {
            var query = new Parse.Query(ModelName);
            var field  = Object.keys(param)[0];
            query.fullText(field,param[field], {caseSensitive : false});
            return query;
        });
    }, 

    /**
     * Method buildSortParameters
     * Based on DataTable parameters, this method returns an ordering parameter for the appropriate field
     * The params object must contain the following properties:
     * order: Array containing a single object
     * order[0].column: A string parseable to an Integer, that references the column index of the reference field
     * order[0].dir: A string that can be either 'asc' for ascending order or 'desc' for descending order
     * columns: Array of column's description object
     * columns[i].data: The name of the field in MongoDB. If the index i is equal to order[0].column, and
     * the column is orderable, then this will be the returned search param
     * columns[i].orderable: A string (either 'true' or 'false') that denotes if the given column is orderable
     * @param params
     * @returns {*}
     */
    buildSortParameters = function (params) {
        if (!params || !Array.isArray(params.order) || params.order.length === 0) {
            console.log("sort Null", params)
            return null;
        }

        var sortColumn = Number(params.order[0].column),
            sortOrder = params.order[0].dir,
            sortField;

        if (isNaNorUndefined(sortColumn) || !Array.isArray(params.columns) || sortColumn >= params.columns.length) {
            return null;
        }

        if (params.columns[sortColumn].orderable === 'false') {
            return null;
        }

        sortField = params.columns[sortColumn].data;

        if (!sortField) {
            return null;
        }

        if (sortOrder === 'asc') {
            return sortField;
        }

        return '-' + sortField;
    },

    buildSelectParameters = function (params) {

        if (!params || !params.columns || !Array.isArray(params.columns)) {
            console.log("select Null", params)
            return null;
        }

        return params
            .columns
            .map(col => col.data);
    },

    /**
     * Run wrapper function
     * Serves only to the ModelName parameter in the wrapped run function's scope
     * @param {String} ModelName The Parse model class(column) name, target of the search
     * @returns {Function} the actual run function with Model in its scope
     */
    
    run = function (ModelName) {

        var ParseModel = Parse.Object.extend(ModelName);
        
        /**
         * Method Run
         * The actual run function
         * Performs the query on the passed ModelName class, using the DataTable params argument
         * @param {Object} params DataTable params object
         */
        return function (params) {
                params = parseRequest(params)
            var draw = Number(params.draw),
                start = Number(params.start),
                length = Number(params.length),
                findParameters = buildFindParameters(params),
                sortParameters = buildSortParameters(params),
                selectParameters = buildSelectParameters(params),
                recordsTotal,
                recordsFiltered;

            return new Promise(function (fullfill, reject) {
                var queries = orQueries(findParameters);

                async.series([
                    function checkParams (cb) {
                        if (isNaNorUndefined(draw, start, length)) {
                            return cb(new Error('Some parameters are missing or in a wrong state. ' +
                            'Could be any of draw, start or length'));
                        }

                        if (!findParameters || !sortParameters || !selectParameters) {
                            return cb(new Error('Invalid findParameters or sortParameters or selectParameters'));
                        }
                        cb();
                    },
                    function fetchRecordsTotal (cb) {
                        
                        var query = new Parse.Query(ModelName);
                        console.log("fetchRecordsTotal")
                        query.count().then(function (count) {
                            recordsTotal = count;
                            cb();
                        }).catch(function (err) {
                                console.log("fetchRecordsTotal",err)
                                return cb(err);
                        });
                    },
                    function fetchRecordsFiltered (cb) {
                        var query = new Parse.Query(ModelName);
                        if(queries && queries.length){
                            query = query._orQuery(queries)
                        }
                        query.count().then(function (count) {
                            
                            recordsFiltered = count;
                            cb();
                        }).catch(function (err) {
                            return cb(err);
                        });
                    },
                    function runQuery (cb) {
                        var query = new Parse.Query(ModelName);
                        if(queries && queries.length){
                            query = query._orQuery(queries)
                        }

                        query = query
                            .select(selectParameters)
                            .limit(length)
                            .skip(start);
                        if(sortParameters && sortParameters.charAt(0)==='-') {
                            query = query.descending(sortParameters.substring(1))
                        } else {
                            query = query.ascending(sortParameters)
                        }
                        query.find().then(function (results) {
                            cb(null, {
                                draw: draw,
                                recordsTotal: recordsTotal,
                                recordsFiltered: recordsFiltered,
                                data: results
                            });
                        }).catch(function (err) {
                            return cb(err);
                        });
                        
                    }
                ], function resolve (err, results) {
                    if (err) {
                        reject({
                            error: err
                        });
                    } else {
                        var answer = results[results.length - 1];
                        fullfill(answer);
                    }
                });
            });
        };
    },

    /**
     * Module datatablesQueryParse
     * Performs queries in the given Parse Model class, following DataTables conventions for search and
     * pagination.
     * The only interesting exported function is `run`. The others are exported only to allow unit testing.
     * @param Model
     * @returns {{run: Function, isNaNorUndefined: Function, buildFindParameters: Function, buildSortParameters:
     *     Function}}
     */
    datatablesQueryParse = function (ModelName) {
        return {
            run: run(ModelName),
            isNaNorUndefined: isNaNorUndefined,
            buildFindParameters: buildFindParameters,
            buildSortParameters: buildSortParameters,
            buildSelectParameters: buildSelectParameters
        };
    };

module.exports = datatablesQueryParse;
