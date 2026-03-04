// babel.config.js — standard Expo Babel preset for the demo app.
module.exports = function (api) {
  // Cache the Babel config for faster subsequent builds
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
