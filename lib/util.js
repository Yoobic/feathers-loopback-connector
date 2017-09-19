'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.parse = parse;
exports.getLimit = getLimit;
exports.coerceWhereKey = coerceWhereKey;
exports.traverse = traverse;
exports.shouldSetValue = shouldSetValue;
exports.coerceQueryToWhereFilter = coerceQueryToWhereFilter;
exports.coerceSelectToFields = coerceSelectToFields;
exports.coerceSortToOrder = coerceSortToOrder;
exports.coerceSkip = coerceSkip;
exports.coerceLimit = coerceLimit;
exports.coerceQueryToLoopbackFilter = coerceQueryToLoopbackFilter;

var _lodash = require('lodash.set');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.isempty');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.isundefined');

var _lodash6 = _interopRequireDefault(_lodash5);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

function coerceWhereKey(key) {
  switch (key) {
    // non-where operators, return null
    case '$sort':
    case '$select':
    case '$include':
    case '$skip':
    case '$limit':
      return null;

    // where property operators
    case '$in':
      return 'inq';
    case '$nin':
      return 'nin';
    case '$lt':
      return 'lt';
    case '$lte':
      return 'lte';
    case '$gt':
      return 'gt';
    case '$gte':
      return 'gte';
    case '$ne':
      return 'neq';
    case '$not':
      return 'neq';
    case '$or':
      return 'or';
    case '$and':
      return 'and';
    case '$between':
      return 'between';
    case '$inq':
      return 'inq';
    case '$like':
      return 'like';
    case '$nlike':
      return 'nlike';
    case '$ilike':
      return 'ilike';
    case '$nilike':
      return 'nilike';
    case '$regexp':
      return 'regexp';
    case '$near':
      return 'near';
    case '$maxDistance':
      return 'maxDistance';
    case '$minDistance':
      return 'minDistance';
    case '$unit':
      return 'unit';

    // other properties should go into where
    default:
      return key;
  }
}

function traverse(o, fn) {
  for (var _len = arguments.length, path = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    path[_key - 2] = arguments[_key];
  }

  var _this = this;

  Object.keys(o).forEach(function (k) {
    var descend = fn.apply(_this, [o[k]].concat(path, [k.toString()]));
    if (descend !== false && o[k] !== null && _typeof(o[k]) === 'object') {
      // going one step down in the object tree!!
      traverse.apply(_this, [o[k], fn].concat(path, [k.toString()]));
    }
  });
}

function shouldSetValue(value, path) {
  return path.indexOf(null) === -1 && (value === null || (typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object') && !(0, _lodash6.default)(value);
}

function coerceQueryToWhereFilter(query) {
  var where = {};
  traverse(query, function (value) {
    for (var _len2 = arguments.length, p = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      p[_key2 - 1] = arguments[_key2];
    }

    var path = p.map(function (k) {
      return coerceWhereKey(k);
    });
    if (shouldSetValue(value, path)) {
      (0, _lodash2.default)(where, path, value);
    }
    return path.indexOf(null) === -1;
  });
  return where;
}

function coerceSelectToFields($select, idProp) {
  return $select.reduce(function (acc, item) {
    return Object.assign(acc, _defineProperty({}, item, true));
  }, idProp ? _defineProperty({}, idProp, true) : {});
}

function coerceSortToOrder($sort) {
  return Object.keys($sort).reduce(function (acc, key) {
    // eslint-disable-next-line eqeqeq
    return $sort[key] == 1 ? acc.concat(key + ' ASC') : $sort[key] == -1 ? acc.concat(key + ' DESC') : acc;
  }, []);
}

function coerceSkip(query) {
  if (Number.isInteger(query.skip)) {
    return parse(query.skip);
  } else if (Number.isInteger(query.$skip)) {
    return parse(query.$skip);
  }
  return null;
}

function coerceLimit(query) {
  if (Number.isInteger(query.limit)) {
    return parse(query.limit);
  } else if (Number.isInteger(query.$limit)) {
    return parse(query.$limit);
  }
  return null;
}

function coerceQueryToLoopbackFilter(query, idProp) {
  var filter = {};

  filter.where = !(0, _lodash4.default)(query.where) ? query.where : coerceQueryToWhereFilter(query);
  filter.order = !(0, _lodash4.default)(query.order) ? query.order : !(0, _lodash4.default)(query.$sort) ? coerceSortToOrder(query.$sort) : {};
  filter.fields = !(0, _lodash4.default)(query.fields) ? query.fields : !(0, _lodash4.default)(query.$select) ? coerceSelectToFields(query.$select, idProp) : [];
  filter.include = !(0, _lodash4.default)(query.include) ? query.include : !(0, _lodash4.default)(query.$include) ? query.$include : [];
  filter.skip = coerceSkip(query);
  filter.limit = coerceLimit(query);

  Object.keys(filter).forEach(function (key) {
    if (!Number.isInteger(filter[key]) && (0, _lodash4.default)(filter[key])) {
      delete filter[key];
    }
  });

  return filter;
}