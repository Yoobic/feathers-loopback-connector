'use strict';
const errors = require('feathers-errors');
const makeDebug = require('debug');
const debug = makeDebug('feathers-loopback-connector');
// const error = makeDebug('feathers-loopback-connector:error');
const commons = require('feathers-commons');
const _isUndefined = require('lodash.isundefined');
// const _isEmpty = require('lodash.isempty');
const _cloneDeep = require('lodash.clonedeep');
const _merge = require('lodash.merge');
const _set = require('lodash.set');
const _unset = require('lodash.unset');
// if (!global._babelPolyfill) { require('babel-polyfill'); }

function parse (num) {
  if (Number.isFinite(num)) {
    return Math.abs(Number.parseInt(num));
  }
}
function getLimit (limit, paginate) {
  limit = parse(limit);
  if (paginate && paginate.default) {
    const lower = Number.isInteger(limit) ? limit : paginate.default;
    const upper = Number.isInteger(paginate.max) ? paginate.max : Number.MAX_VALUE;
    return Math.min(lower, upper);
  }
  return limit;
}

function coerceQueryEntry (value, key, ...path) {
  switch (key) {
    // order, limit, include, fields, skip operators
    case '$sort':
      return {
        path,
        key: 'order',
        // eslint-disable-next-line eqeqeq
        value: Object.keys(value).reduce((acc, key) => value[key] == 1 ? acc.concat(`${key} ASC`) : value[key] == -1 ? acc.concat(`${key} DESC`) : acc, []),
        descend: false
      };
    case '$select':
      return { path, key: 'fields', value, descend: false };
    case '$limit':
      return { path, key: 'limit', value: parse(value), descend: false };
    case '$include':
      return { path, key: 'include', value, descend: false };
    case '$skip':
      return Number.isSafeInteger(value) ? { path, key: 'skip', value: parse(value), descend: false } : null;

    // where property operators
    case '$in':
      return { path: ['where', ...path], key: 'inq', unset: key, value };
    case '$nin':
      return { path: ['where', ...path], key: 'nin', unset: key, value };
    case '$lt':
      return { path: ['where', ...path], key: 'lt', unset: key, value };
    case '$lte':
      return { path: ['where', ...path], key: 'lte', unset: key, value };
    case '$gt':
      return { path: ['where', ...path], key: 'gt', unset: key, value };
    case '$gte':
      return { path: ['where', ...path], key: 'gte', unset: key, value };
    case '$ne':
      return { path: ['where', ...path], key: 'neq', unset: key, value };
    case '$not':
      return { path: ['where', ...path], key: 'neq', unset: key, value };
    case '$or':
      return { path: ['where', ...path], key: 'or', unset: key, value };
    case '$and':
      return { path: ['where', ...path], key: 'and', unset: key, value };
    case '$between':
      return { path: ['where', ...path], key: 'between', unset: key, value };
    case '$inq':
      return { path: ['where', ...path], key: 'inq', unset: key, value };
    case '$like':
      return { path: ['where', ...path], key: 'like', unset: key, value };
    case '$nlike':
      return { path: ['where', ...path], key: 'nlike', unset: key, value };
    case '$ilike':
      return { path: ['where', ...path], key: 'ilike', unset: key, value };
    case '$nilike':
      return { path: ['where', ...path], key: 'nilike', unset: key, value };
    case '$regexp':
      return { path: ['where', ...path], key: 'regexp', unset: key, value };
    case '$near':
      return { path: ['where', ...path], key: 'near', unset: key, value };
    case '$maxDistance':
      return { path: ['where', ...path], key: 'maxDistance', unset: key, value };
    case '$minDistance':
      return { path: ['where', ...path], key: 'minDistance', unset: key, value };
    case '$unit':
      return { path: ['where', ...path], key: 'unit', unset: key, value };

        // other properties should go directly into where
    default:
      return { path: ['where', ...path], key, value };
  }
}

function traverse (o, fn, ...path) {
  Object.keys(o).forEach((k) => {
    let descend = fn.apply(this, [o[k], k.toString(), ...path]);
    if (descend !== false && o[k] !== null && typeof o[k] === 'object') {
      // going one step down in the object tree!!
      traverse.apply(this, [o[k], fn, ...path, k.toString()]);
    }
  });
}

function coerceParamsToLoopbackFilter ({ query }) {
  let entries = [];
  traverse(query, (value, key, ...path) => {
    let coerced = coerceQueryEntry(value, key, ...path);
    if (coerced && !_isUndefined(coerced.value)) {
      entries.push(coerced);
    }
    if (coerced.path[0] === 'limit') {
      console.log('LIMIT', coerced);
    }
    return coerced && coerced.descend !== false;
  });
  let filter = entries.reduce((acc, { path, key, value }) => {
    return _set(acc, [...path, key], value);
  }, {});
  entries.filter(c => c.unset).forEach(({ path, unset }) => {
    _unset(filter, [...path, unset]);
  });
  return filter;
}

class Service {
  constructor (options = {}) {
    this.options = options;
    this.paginate = options.paginate || {};
    this.id = options.id || 'id';
    this.events = options.events || [];
    this.model = options.Model;
  }

  transformQuery (params, paginate = {}) {
    let query = {};
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

  find (params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate;
    params.query = params.query || {};
    const filter = this.transformQuery(params, paginate);
    if (!paginate.default) {
      return this.model.find(filter);
    }
    return Promise.all([this.model.count(filter.where), this.model.find(filter)])
      .then(([count, results]) => ({
        total: count,
        skip: params.query.$skip ? parse(params.query.$skip) : 0,
        limit: getLimit(params.query.$limit, paginate),
        data: results
      }));
  }

  get (id, params) {
    const select = commons.select(params, this.id);
    return this.model.findById(id).then(result => {
      if (!result) {
        return Promise.reject(
          new errors.NotFound(`No record found for id '${id}'`)
        );
      }
      return Promise.resolve(result)
        .then(select);
    });
  }
  create (data, params) {
    const select = commons.select(params, this.id);
    if (data instanceof Array) {
      return this.model.create(data);
    } else {
      return this.model.create(data)
        .then(select);
    }
  }
  update (id, data, params) {
    const select = commons.select(params, this.id);
    if (Array.isArray(data) || id === null) {
      return Promise.reject(new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
    }
    delete data.id;
    return this.model.replaceById(id, data)
      .then(select)
      .catch(() => {
        return Promise.reject(
          new errors.NotFound(`No record found for id '${id}'`)
        );
      });
  }
  patch (id, data, params) {
    const filter = this.transformQuery(params);
    const select = commons.select(params, this.id);
    // if (id === null && !_isEmpty(filter.where)) {
    if (id === null) {
      return this.model.updateAll(filter.where, data)
        .then((result) => {
          params.query = data;
          return this.model.find(this.transformQuery(params));
        });
    }
    return this.model.findById(id)
      .then(result => {
        if (!result) {
          return Promise.reject(
            new errors.NotFound(`No record found for id '${id}'`)
          );
        }
        let patchData = _merge({}, _cloneDeep(result), _cloneDeep(data));
        delete patchData.id;
        return this.model.replaceById(id, patchData);
      })
      .then(select)
      .catch(() => {
        return Promise.reject(
          new errors.NotFound(`No record found for id '${id}'`)
        );
      });
  }
  remove (id, params) {
    const filter = this.transformQuery(params, {});
    const select = commons.select(params, this.id);
    // if (id === null && !_isEmpty(filter.where)) {
    if (id === null) {
      return this.model.find(filter)
        .then((results) => {
          return this.model.destroyAll(filter.where || {})
            .then(() => select(results));
        });
    }

    return this.model.findById(id).then(result => {
      if (!result) {
        return Promise.reject(
          new errors.NotFound(`No record found for id '${id}'`)
        );
      }
      return this.model.destroyById(id)
        .then(() => select(result));
    });
  }
}

export default function init (options) {
  debug('Initializing feathers-loopback-connector adapter');
  return new Service(options);
}

init.Service = Service;
