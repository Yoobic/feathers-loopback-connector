'use strict';
import errors from 'feathers-errors';
import makeDebug from 'debug';
import commons from 'feathers-commons';
import _isUndefined from 'lodash.isundefined';
import { coerceQueryToLoopbackFilter, getLimit, parse } from './util';
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
    const getResults = () => filter.limit === 0 ? Promise.resolve([]) : this.model.find(filter);
    if (!paginate.default) {
      return getResults();
    }
    return Promise.all([this.model.count(filter.where), getResults()])
      .then(([count, results]) => ({
        total: count,
        skip: params.query.$skip ? parse(params.query.$skip) : 0,
        limit: getLimit(params.query.$limit, paginate),
        data: results
      }));
  }

  get (id, params) {
    const filter = this.transformQuery(params);
    const select = commons.select(params, this.id);
    debug('GETTING WITH ID', id);
    return this.model.findById(id, filter)
      .then(result => {
        if (!result) {
          return Promise.reject(
            new errors.NotFound(`No record found for id '${id}'`)
          );
        }
        debug('RESULT', result);
        debug('SELECTED RESULT', select(result));

        return result;
      })
      .then(select);
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
    if (id === null) {
      let ids;
      return this.model.find({ where: filter.where, fields: [this.id] })
        .then((results) => {
          ids = results.map(item => item[this.id]);
          return this.model.updateAll(filter.where, data);
        })
        .then(() => this.model.find({ where: { [this.id]: { inq: ids } } }))
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
