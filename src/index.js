'use strict';
const errors = require('feathers-errors');
const makeDebug = require('debug');
const debug = makeDebug('feathers-loopback-connector');
// const error = makeDebug('feathers-loopback-connector:error');
const commons = require('feathers-commons');
const _isUndefined = require('lodash.isundefined');
const _isEmpty = require('lodash.isempty');
const _cloneDeep = require('lodash.clonedeep');
const _merge = require('lodash.merge');
const _transform = require('lodash.transform');
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

function coerceQueryEntry (value, key) {
  switch (key) {
        // order, limit, include, fields, skip operators
    case '$sort':
      // eslint-disable-next-line eqeqeq
      return { order: Object.keys(value).reduce((acc, key) => value[key] == 1 ? acc.concat(`${key} ASC`) : value[key] == -1 ? acc.concat(`${key} DESC`) : acc, []) };
    case '$select':
      return { fields: value };
    case '$limit':
      return { limit: parse(value) };
    case '$include':
      return { include: value };
    case '$skip':
      return Number.isSafeInteger(value) ? { skip: parse(value) } : {};

        // where operators
    case '$in':
      return { where: { inq: value } };
    case '$nin':
      return { where: { nin: value } };
    case '$lt':
      return { where: { lt: value } };
    case '$lte':
      return { where: { lte: value } };
    case '$gt':
      return { where: { gt: value } };
    case '$gte':
      return { where: { gte: value } };
    case '$ne':
      return { where: { neq: value } };
    case '$not':
      return { where: { neq: value } };
    case '$or':
      return { where: { or: value } };
    case '$and':
      return { where: { and: value } };
    case '$between':
      return { where: { between: value } };
    case '$inq':
      return { where: { inq: value } };
    case '$like':
      return { where: { like: value } };
    case '$nlike':
      return { where: { nlike: value } };
    case '$ilike':
      return { where: { ilike: value } };
    case '$nilike':
      return { where: { nilike: value } };
    case '$regexp':
      return { where: { regexp: value } };
    case '$near':
      return { where: { near: value } };
    case '$maxDistance':
      return { where: { maxDistance: value } };
    case '$minDistance':
      return { where: { minDistance: value } };
    case '$unit':
      return { where: { unit: value } };

        // other properties should go directly into where
    default:
      return { where: { [key]: value } };
  }
}

function coerceParamsToLoopbackFilter ({ query }) {
  return _transform(query, (acc, value, key) => {
    if (!_isUndefined(value)) {
      _merge(acc, coerceQueryEntry(value, key));
    }
  }, {});
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
        limit: getLimit(params.query.$limit, paginate) || null,
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
    if (id === null && !_isEmpty(filter.where)) {
      return this.model.updateAll(filter.where, data)
        .then((result) => {
          params.query = data;
          return this.model.find(filter);
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
    if (id === null && !_isEmpty(filter.where)) {
      return this.model.find(filter)
        .then((results) => {
          return this.model.destroyAll(filter.where)
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
