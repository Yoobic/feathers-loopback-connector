'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = init;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var errors = require('feathers-errors');
var makeDebug = require('debug');
var debug = makeDebug('feathers-loopback-connector');
// const error = makeDebug('feathers-loopback-connector:error');
var commons = require('feathers-commons');
var _isUndefined = require('lodash.isundefined');
// const _isEmpty = require('lodash.isempty');
var _cloneDeep = require('lodash.clonedeep');
var _merge = require('lodash.merge');
var _set = require('lodash.set');
var _unset = require('lodash.unset');
// if (!global._babelPolyfill) { require('babel-polyfill'); }

function parse(num) {
  if (Number.isFinite(num)) {
    return Math.abs(Number.parseInt(num));
  }
}
function getLimit(limit, paginate) {
  limit = parse(limit);
  if (paginate && paginate.default) {
    var lower = Number.isInteger(limit) ? limit : paginate.default;
    var upper = Number.isInteger(paginate.max) ? paginate.max : Number.MAX_VALUE;
    return Math.min(lower, upper);
  }
  return limit;
}

function coerceQueryEntry(value, key) {
  for (var _len = arguments.length, path = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    path[_key - 2] = arguments[_key];
  }

  switch (key) {
    // order, limit, include, fields, skip operators
    case '$sort':
      return {
        path: path,
        key: 'order',
        // eslint-disable-next-line eqeqeq
        value: Object.keys(value).reduce(function (acc, key) {
          return value[key] == 1 ? acc.concat(key + ' ASC') : value[key] == -1 ? acc.concat(key + ' DESC') : acc;
        }, []),
        descend: false
      };
    case '$select':
      return { path: path, key: 'fields', value: value, descend: false };
    case '$limit':
      return { path: path, key: 'limit', value: parse(value), descend: false };
    case '$include':
      return { path: path, key: 'include', value: value, descend: false };
    case '$skip':
      return Number.isSafeInteger(value) ? { path: path, key: 'skip', value: parse(value), descend: false } : null;

    // where property operators
    case '$in':
      return { path: ['where'].concat(path), key: 'inq', unset: key, value: value };
    case '$nin':
      return { path: ['where'].concat(path), key: 'nin', unset: key, value: value };
    case '$lt':
      return { path: ['where'].concat(path), key: 'lt', unset: key, value: value };
    case '$lte':
      return { path: ['where'].concat(path), key: 'lte', unset: key, value: value };
    case '$gt':
      return { path: ['where'].concat(path), key: 'gt', unset: key, value: value };
    case '$gte':
      return { path: ['where'].concat(path), key: 'gte', unset: key, value: value };
    case '$ne':
      return { path: ['where'].concat(path), key: 'neq', unset: key, value: value };
    case '$not':
      return { path: ['where'].concat(path), key: 'neq', unset: key, value: value };
    case '$or':
      return { path: ['where'].concat(path), key: 'or', unset: key, value: value };
    case '$and':
      return { path: ['where'].concat(path), key: 'and', unset: key, value: value };
    case '$between':
      return { path: ['where'].concat(path), key: 'between', unset: key, value: value };
    case '$inq':
      return { path: ['where'].concat(path), key: 'inq', unset: key, value: value };
    case '$like':
      return { path: ['where'].concat(path), key: 'like', unset: key, value: value };
    case '$nlike':
      return { path: ['where'].concat(path), key: 'nlike', unset: key, value: value };
    case '$ilike':
      return { path: ['where'].concat(path), key: 'ilike', unset: key, value: value };
    case '$nilike':
      return { path: ['where'].concat(path), key: 'nilike', unset: key, value: value };
    case '$regexp':
      return { path: ['where'].concat(path), key: 'regexp', unset: key, value: value };
    case '$near':
      return { path: ['where'].concat(path), key: 'near', unset: key, value: value };
    case '$maxDistance':
      return { path: ['where'].concat(path), key: 'maxDistance', unset: key, value: value };
    case '$minDistance':
      return { path: ['where'].concat(path), key: 'minDistance', unset: key, value: value };
    case '$unit':
      return { path: ['where'].concat(path), key: 'unit', unset: key, value: value };

    // other properties should go directly into where
    default:
      return { path: ['where'].concat(path), key: key, value: value };
  }
}

function traverse(o, fn) {
  for (var _len2 = arguments.length, path = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
    path[_key2 - 2] = arguments[_key2];
  }

  var _this = this;

  Object.keys(o).forEach(function (k) {
    var descend = fn.apply(_this, [o[k], k.toString()].concat(path));
    if (descend !== false && o[k] !== null && _typeof(o[k]) === 'object') {
      // going one step down in the object tree!!
      traverse.apply(_this, [o[k], fn].concat(path, [k.toString()]));
    }
  });
}

function coerceParamsToLoopbackFilter(_ref) {
  var query = _ref.query;

  var entries = [];
  traverse(query, function (value, key) {
    for (var _len3 = arguments.length, path = Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
      path[_key3 - 2] = arguments[_key3];
    }

    var coerced = coerceQueryEntry.apply(undefined, [value, key].concat(path));
    if (coerced && !_isUndefined(coerced.value)) {
      entries.push(coerced);
    }
    if (coerced.path[0] === 'limit') {
      console.log('LIMIT', coerced);
    }
    return coerced && coerced.descend !== false;
  });
  var filter = entries.reduce(function (acc, _ref2) {
    var path = _ref2.path,
        key = _ref2.key,
        value = _ref2.value;

    return _set(acc, [].concat(_toConsumableArray(path), [key]), value);
  }, {});
  entries.filter(function (c) {
    return c.unset;
  }).forEach(function (_ref3) {
    var path = _ref3.path,
        unset = _ref3.unset;

    _unset(filter, [].concat(_toConsumableArray(path), [unset]));
  });
  return filter;
}

var Service = function () {
  function Service() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Service);

    this.options = options;
    this.paginate = options.paginate || {};
    this.id = options.id || 'id';
    this.events = options.events || [];
    this.model = options.Model;
  }

  _createClass(Service, [{
    key: 'transformQuery',
    value: function transformQuery(params) {
      var paginate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var query = {};
      if (params.query) {
        query = coerceParamsToLoopbackFilter(params);
        query.limit = getLimit(query.limit, paginate);
        if (_isUndefined(query.limit)) {
          delete query.limit;
        }

        console.log('New Query', query);
        debug('New Query', query);
        return query;
      }
      return params;
    }
  }, {
    key: 'find',
    value: function find(params) {
      var paginate = params && typeof params.paginate !== 'undefined' ? params.paginate : this.paginate;
      params.query = params.query || {};
      var filter = this.transformQuery(params, paginate);
      if (!paginate.default) {
        return this.model.find(filter);
      }
      return Promise.all([this.model.count(filter.where), this.model.find(filter)]).then(function (_ref4) {
        var _ref5 = _slicedToArray(_ref4, 2),
            count = _ref5[0],
            results = _ref5[1];

        return {
          total: count,
          skip: params.query.$skip ? parse(params.query.$skip) : 0,
          limit: getLimit(params.query.$limit, paginate),
          data: results
        };
      });
    }
  }, {
    key: 'get',
    value: function get(id, params) {
      var select = commons.select(params, this.id);
      return this.model.findById(id).then(function (result) {
        if (!result) {
          return Promise.reject(new errors.NotFound('No record found for id \'' + id + '\''));
        }
        return Promise.resolve(result).then(select);
      });
    }
  }, {
    key: 'create',
    value: function create(data, params) {
      var select = commons.select(params, this.id);
      if (data instanceof Array) {
        return this.model.create(data);
      } else {
        return this.model.create(data).then(select);
      }
    }
  }, {
    key: 'update',
    value: function update(id, data, params) {
      var select = commons.select(params, this.id);
      if (Array.isArray(data) || id === null) {
        return Promise.reject(new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
      }
      delete data.id;
      return this.model.replaceById(id, data).then(select).catch(function () {
        return Promise.reject(new errors.NotFound('No record found for id \'' + id + '\''));
      });
    }
  }, {
    key: 'patch',
    value: function patch(id, data, params) {
      var _this2 = this;

      var filter = this.transformQuery(params);
      var select = commons.select(params, this.id);
      // if (id === null && !_isEmpty(filter.where)) {
      if (id === null) {
        return this.model.updateAll(filter.where, data).then(function (result) {
          params.query = data;
          return _this2.model.find(_this2.transformQuery(params));
        });
      }
      return this.model.findById(id).then(function (result) {
        if (!result) {
          return Promise.reject(new errors.NotFound('No record found for id \'' + id + '\''));
        }
        var patchData = _merge({}, _cloneDeep(result), _cloneDeep(data));
        delete patchData.id;
        return _this2.model.replaceById(id, patchData);
      }).then(select).catch(function () {
        return Promise.reject(new errors.NotFound('No record found for id \'' + id + '\''));
      });
    }
  }, {
    key: 'remove',
    value: function remove(id, params) {
      var _this3 = this;

      var filter = this.transformQuery(params, {});
      var select = commons.select(params, this.id);
      // if (id === null && !_isEmpty(filter.where)) {
      if (id === null) {
        return this.model.find(filter).then(function (results) {
          return _this3.model.destroyAll(filter.where || {}).then(function () {
            return select(results);
          });
        });
      }

      return this.model.findById(id).then(function (result) {
        if (!result) {
          return Promise.reject(new errors.NotFound('No record found for id \'' + id + '\''));
        }
        return _this3.model.destroyById(id).then(function () {
          return select(result);
        });
      });
    }
  }]);

  return Service;
}();

function init(options) {
  debug('Initializing feathers-loopback-connector adapter');
  return new Service(options);
}

init.Service = Service;
module.exports = exports['default'];