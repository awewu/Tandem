function createLazyEngine(name, factory, options = {}) {
  let instance;
  let loaded = false;

  function load() {
    if (!loaded) {
      instance = factory();
      loaded = true;
    }
    return instance;
  }

  function lazyHealthCheck() {
    if (!loaded) {
      return {
        status: 'lazy',
        loaded: false,
        name,
        runtimeProfile: options.runtimeProfile || 'safe'
      };
    }

    const target = load();
    if (target && typeof target.healthCheck === 'function') {
      return target.healthCheck();
    }

    return {
      status: 'ok',
      loaded: true,
      name,
      note: 'loaded engine has no healthCheck method'
    };
  }

  return new Proxy({}, {
    get(_target, prop) {
      if (prop === '__isLazyEngine') return true;
      if (prop === '__lazyName') return name;
      if (prop === '__isLoaded') return () => loaded;
      if (prop === '__getTarget') return load;
      if (prop === 'healthCheck') return lazyHealthCheck;
      if (prop === Symbol.toStringTag) return 'LazyEngine';
      if (prop === 'toJSON') {
        return () => ({
          name,
          loaded,
          status: loaded ? 'loaded' : 'lazy'
        });
      }

      const target = load();
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },

    set(_target, prop, value) {
      const target = load();
      target[prop] = value;
      return true;
    },

    has(_target, prop) {
      if (['__isLazyEngine', '__lazyName', '__isLoaded', '__getTarget', 'healthCheck'].includes(prop)) {
        return true;
      }
      return prop in load();
    },

    ownKeys() {
      return loaded ? Reflect.ownKeys(load()) : ['__lazyName'];
    },

    getOwnPropertyDescriptor(_target, prop) {
      if (!loaded && prop === '__lazyName') {
        return {
          enumerable: false,
          configurable: true,
          value: name
        };
      }

      const descriptor = Object.getOwnPropertyDescriptor(load(), prop);
      return descriptor || {
        enumerable: true,
        configurable: true
      };
    }
  });
}

function attachLazyRuntime(engines) {
  Object.defineProperty(engines, '__lazyRuntime', {
    enumerable: false,
    configurable: false,
    value: {
      getLazyEngineNames() {
        return Object.entries(engines)
          .filter(([, engine]) => engine && engine.__isLazyEngine)
          .map(([name]) => name);
      },
      getLoadedEngineNames() {
        return Object.entries(engines)
          .filter(([, engine]) => engine && engine.__isLazyEngine && engine.__isLoaded())
          .map(([name]) => name);
      },
      getStatus() {
        return Object.fromEntries(Object.entries(engines)
          .filter(([, engine]) => engine && engine.__isLazyEngine)
          .map(([name, engine]) => [name, {
            lazyName: engine.__lazyName,
            loaded: engine.__isLoaded()
          }]));
      }
    }
  });

  return engines;
}

module.exports = {
  attachLazyRuntime,
  createLazyEngine
};
