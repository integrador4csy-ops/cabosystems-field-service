const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Loading the full emoji catalog can exceed Windows' open-file limit when
// Metro reads thousands of cached modules during an on-demand bundle request.
if (process.platform === 'win32') {
  let active = 0;
  const waiting = [];
  const schedule = async (operation) => {
    if (active >= 32) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try { return await operation(); }
    finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
  config.cacheStores = config.cacheStores.map((store) => ({
    get: (key) => schedule(() => store.get(key)),
    set: (key, value) => schedule(() => store.set(key, value)),
    clear: () => store.clear(),
  }));
}

module.exports = config;
