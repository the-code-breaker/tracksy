module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { colors: { navy: "#102c35", teal: "#087f70", canvas: "#f5f7f8" } },
  },
  plugins: [],
};
