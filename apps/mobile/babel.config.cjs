module.exports = function (api) {
  api.cache(true);
  return {
    // Controls use React Native styles, including Pressable state callbacks.
    // CSS interop must not intercept and flatten those callbacks on Android.
    presets: ["babel-preset-expo"],
  };
};
