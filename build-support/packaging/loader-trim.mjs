function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`Expected one ${label} in Closure output, found ${count}`);
  }
  return source.replace(before, after);
}

export function trimBase122Loader(source) {
  let result = replaceOnce(
    source,
    'return Uint8Array.from(f)',
    'return f',
    'Base122 byte-array conversion',
  );
  result = replaceOnce(result, '(function(){', '(()=>{', 'outer IIFE start');
  return replaceOnce(result, '}).call(this);', '})();', 'outer IIFE end');
}
