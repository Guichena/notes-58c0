// Serial invocation AND ordered emission; callbacks may return values/thenables.
export function ordered(items, callback, emit = () => undefined) {
  let input;
  try {
    if (!Array.isArray(items) || typeof callback !== 'function' || typeof emit !== 'function') {
      throw new TypeError('array <=10000 and functions required');
    }
    const length = items.length; // Read once; never use a caller-defined iterator.
    if (!Number.isInteger(length) || length < 0 || length > 10000) {
      throw new TypeError('array length must be 0..10000');
    }
    input = new Array(length);
    // Getters/proxy traps must finish; a slot bound cannot preempt user code.
    for (let i = 0; i < length; ++i) input[i] = items[i];
  } catch (error) {
    return Promise.reject(error);
  }
  const results = [];
  let chain = Promise.resolve();
  for (let i = 0; i < input.length; ++i) {
    chain = chain.then(() => callback(input[i], i))
      .then(value => Promise.resolve(emit(value, i)).then(() => {
        results.push(value);
      }));
  }
  return chain.then(() => results);
}

