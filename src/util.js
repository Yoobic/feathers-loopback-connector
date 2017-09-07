import _set from 'lodash.set';
import _isEmpty from 'lodash.isempty';
import _isUndefined from 'lodash.isundefined';

export function parse (num) {
  if (Number.isFinite(num)) {
    return Math.abs(Number.parseInt(num));
  }
}
export function getLimit (limit, paginate) {
  limit = parse(limit);
  if (paginate && paginate.default) {
    const lower = Number.isInteger(limit) ? limit : paginate.default;
    const upper = Number.isInteger(paginate.max) ? paginate.max : Number.MAX_VALUE;
    return Math.min(lower, upper);
  }
  return limit;
}

export function coerceWhereKey (key) {
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

export function traverse (o, fn, ...path) {
  Object.keys(o).forEach((k) => {
    let descend = fn.apply(this, [o[k], ...path, k.toString()]);
    if (descend !== false && o[k] !== null && typeof o[k] === 'object') {
      // going one step down in the object tree!!
      traverse.apply(this, [o[k], fn, ...path, k.toString()]);
    }
  });
}

export function shouldSetValue (value, path) {
  return (!_isUndefined(value) || value === null || typeof value !== 'object' || _isEmpty(value)) && path.indexOf(null) === -1;
}

export function coerceQueryToWhereFilter (query) {
  let where = {};
  traverse(query, (value, ...p) => {
    let path = p.map(k => coerceWhereKey(k));
    if (shouldSetValue(value, path)) {
      _set(where, path, value);
    }
    return path.indexOf(null) === -1;
  });
  return where;
}

export function coerceSelectToFields ($select, idProp) {
  return $select.reduce((acc, item) => Object.assign(acc, { [item]: true }), idProp ? { [idProp]: true } : {});
}

export function coerceSortToOrder ($sort) {
  return Object.keys($sort).reduce((acc, key) => {
    // eslint-disable-next-line eqeqeq
    return $sort[key] == 1 ? acc.concat(`${key} ASC`) : $sort[key] == -1 ? acc.concat(`${key} DESC`) : acc;
  }, []);
}

export function coerceQueryToLoopbackFilter (query, idProp) {
  let filter = {};

  filter.where = coerceQueryToWhereFilter(query);

  if (!_isEmpty(query.$sort)) {
    filter.order = coerceSortToOrder(query.$sort);
  }
  if (!_isEmpty(query.$select)) {
    filter.fields = coerceSelectToFields(query.$select, idProp);
  }
  if (!_isEmpty(query.$include)) {
    filter.include = query.$include;
  }
  if (Number.isInteger(query.$skip)) {
    filter.skip = parse(query.$skip);
  }
  if (Number.isInteger(query.$limit)) {
    filter.limit = parse(query.$limit);
  }

  return filter;
}
