'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = init;

var _feathersErrors = require('feathers-errors');

var _feathersErrors2 = _interopRequireDefault(_feathersErrors);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _feathersCommons = require('feathers-commons');

var _feathersCommons2 = _interopRequireDefault(_feathersCommons);

var _lodash = require('lodash.isundefined');

var _lodash2 = _interopRequireDefault(_lodash);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// if (!global._babelPolyfill) { require('babel-polyfill'); }

var debug = (0, _debug2.default)('feathers-loopback-connector');
// const error = makeDebug('feathers-loopback-connector:error');

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
        query = (0, _util.coerceQueryToLoopbackFilter)(params.query, this.id);
        query.limit = (0, _util.getLimit)(query.limit, paginate);
        if ((0, _lodash2.default)(query.limit)) {
          delete query.limit;
        }

        debug('New Query', query);
        return query;
      }
      return params;
    }
  }, {
    key: 'find',
    value: function find(params) {
      var _this = this;

      var paginate = params && typeof params.paginate !== 'undefined' ? params.paginate : this.paginate;
      params.query = params.query || {};
      var filter = this.transformQuery(params, paginate);
      var getResults = function getResults() {
        return filter.limit === 0 ? Promise.resolve([]) : _this.model.find(filter);
      };
      if (!paginate.default) {
        return getResults();
      }
      return Promise.all([this.model.count(filter.where), getResults()]).then(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            count = _ref2[0],
            results = _ref2[1];

        return {
          total: count,
          skip: params.query.$skip ? (0, _util.parse)(params.query.$skip) : 0,
          limit: (0, _util.getLimit)(params.query.$limit, paginate),
          data: results
        };
      });
    }
  }, {
    key: 'get',
    value: function get(id, params) {
      var filter = this.transformQuery(params);
      var select = _feathersCommons2.default.select(params, this.id);
      debug('GETTING WITH ID', id);
      return this.model.findById(id, filter).then(function (result) {
        if (!result) {
          return Promise.reject(new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\''));
        }
        debug('RESULT', result);
        debug('SELECTED RESULT', select(result));

        return result;
      }).then(select);
    }
  }, {
    key: 'create',
    value: function create(data, params) {
      var select = _feathersCommons2.default.select(params, this.id);
      if (data instanceof Array) {
        return this.model.create(data);
      } else {
        return this.model.create(data).then(select);
      }
    }
  }, {
    key: 'update',
    value: function update(id, data, params) {
      var select = _feathersCommons2.default.select(params, this.id);
      if (Array.isArray(data) || id === null) {
        return Promise.reject(new _feathersErrors2.default.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
      }
      delete data.id;
      return this.model.replaceById(id, data).then(select).catch(function () {
        return Promise.reject(new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\''));
      });
    }
  }, {
    key: 'patch',
    value: function patch(id, data, params) {
      var _this2 = this;

      var filter = this.transformQuery(params);
      var select = _feathersCommons2.default.select(params, this.id);
      if (id === null) {
        var ids = void 0;
        return this.model.find({ where: filter.where, fields: [this.id] }).then(function (results) {
          ids = results.map(function (item) {
            return item[_this2.id];
          });
          return _this2.model.updateAll(filter.where, data);
        }).then(function () {
          return _this2.model.find({ where: _defineProperty({}, _this2.id, { inq: ids }) });
        }).then(select);
      }
      return this.model.findById(id).then(function (result) {
        if (!result) {
          return Promise.reject(new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\''));
        }
        return result.updateAttributes(data);
      }).then(select).catch(function () {
        return Promise.reject(new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\''));
      });
    }
  }, {
    key: 'remove',
    value: function remove(id, params) {
      var _this3 = this;

      var filter = this.transformQuery(params);
      var select = _feathersCommons2.default.select(params, this.id);
      if (id === null) {
        return this.model.find(filter).then(function (results) {
          return _this3.model.destroyAll(filter.where || {}).then(function () {
            return select(results);
          });
        });
      }

      return this.model.findById(id).then(function (result) {
        if (!result) {
          return Promise.reject(new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\''));
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