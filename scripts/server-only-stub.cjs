/** Allows running server-only modules from a one-shot CLI script. */
require("module")._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};
