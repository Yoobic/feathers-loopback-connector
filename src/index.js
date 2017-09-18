'use strict';
import errors from 'feathers-errors';
import makeDebug from 'debug';
import commons from 'feathers-commons';
import _isUndefined from 'lodash.isundefined';
import { coerceQueryToLoopbackFilter, getLimit, parse, jsonify } from './util';
// if (!global._babelPolyfill) { require('babel-polyfill'); }

const debug = makeDebug('feathers-loopback-connector');
// const error = makeDebug('feathers-loopback-connector:error');

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
      query = coerceQueryToLoopbackFilter(params.query, this.id);
      query.limit = getLimit(query.limit, paginate);
      if (_isUndefined(query.limit)) {
        delete query.limit;
      }

      debug('New Query', query);
      return query;
    }
    return params;
  }

  find (params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate;
    params.query = params.query || {};
    const filter = this.transformQuery(params, paginate);
    const getResults = () => filter.limit === 0
      ? Promise.resolve([])
      : this.model.find(filter)
        .then(jsonify);
    if (!paginate.default) {
      return getResults();
    }
    let total;
    return this.model.count(filter.where)
      .then(count => {
        total = count;
        return getResults();
      })
      .then(data => ({
        total,
        skip: params.query.$skip ? parse(params.query.$skip) : 0,
        limit: getLimit(params.query.$limit, paginate),
        data
      }));
  }

  get (id, params) {
    const filter = this.transformQuery(params);
    const select = commons.select(params, this.id);
    return this.model.findById(id, filter)
      .then(result => {
        if (!result) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }
        return result;
      })
      .then(jsonify)
      .then(select);
  }
  create (data, params) {
    const select = commons.select(params, this.id);
    return this.model.create(data)
      .then(jsonify)
      .then(select);
  }
  update (id, data, params) {
    const select = commons.select(params, this.id);
    if (Array.isArray(data) || id === null) {
      return Promise.reject(new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
    }
    delete data.id;
    return this.model.replaceById(id, data)
      .then(jsonify)
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
    if (id === null) {
      let ids;
      return this.model.find({ where: filter.where, fields: [this.id] })
        .then((results) => {
          ids = results.map(item => item[this.id]);
          return this.model.updateAll(filter.where, data);
        })
        .then(() => this.model.find({ where: { [this.id]: { inq: ids } } }))
        .then(jsonify)
        .then(select);
    }
    return this.model.findById(id)
      .then(result => {
        if (!result) {
          return Promise.reject(
            new errors.NotFound(`No record found for id '${id}'`)
          );
        }
        return result.updateAttributes(data);
      })
      .then(jsonify)
      .then(select)
      .catch(() => {
        return Promise.reject(
          new errors.NotFound(`No record found for id '${id}'`)
        );
      });
  }
  remove (id, params) {
    const filter = this.transformQuery(params);
    const select = commons.select(params, this.id);
    if (id === null) {
      return this.model.find(filter)
        .then((results) => {
          return this.model.destroyAll(filter.where || {})
            .then(() => results)
            .then(jsonify)
            .then(select);
        });
    }

    return this.model.findById(id)
      .then(result => {
        if (!result) {
          return Promise.reject(
            new errors.NotFound(`No record found for id '${id}'`)
          );
        }
        return this.model.destroyById(id)
          .then(() => result)
          .then(jsonify)
          .then(select);
      });
  }
}

export default function init (options) {
  debug('Initializing feathers-loopback-connector adapter');
  return new Service(options);
}

init.Service = Service;
