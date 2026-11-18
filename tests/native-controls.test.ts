import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { tokens } from "../packages/ui/src/index";

// Exercise the actual Android Babel configuration and real component source.
// Browser rendering bypasses the native CSS interop that caused this failure.
const require = createRequire(import.meta.url);
const babel = require("@babel/core");
const react = require("react");
const native = {
  View: "NativeView",
  Text: "NativeText",
  Pressable: "NativePressable",
  TextInput: "NativeTextInput",
  ScrollView: "NativeScrollView",
  Switch: "NativeSwitch",
  ActivityIndicator: "NativeActivityIndicator",
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: {
    OS: "android",
    select: (values: any) => values.android ?? values.default,
  },
  useColorScheme: () => "light",
};
function compile(relative: string, theme: "light" | "dark", ui?: object) {
  const filename = resolve("apps/mobile", relative);
  const { code } = babel.transformSync(readFileSync(filename, "utf8"), {
    filename,
    configFile: resolve("apps/mobile/babel.config.cjs"),
    caller: {
      name: "metro",
      platform: "android",
      isDev: false,
      supportsStaticESM: false,
    },
  });
  const exports: Record<string, any> = {};
  const modules: Record<string, any> = {
    react,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": native,
    "react-native-safe-area-context": {},
    "react-native-svg": {},
    "lucide-react-native": {},
    "expo-router": {},
    "@tracksy/ui": { tokens },
    "@tracksy/finance": {},
    "./brand": {},
    "./keyboard": {},
    "../lib/state": { usePreferences: (selector: any) => selector({ theme }) },
    "./ui": ui,
  };
  runInNewContext(code, {
    exports,
    require: (id: string) => {
      if (id.endsWith(".png")) return 1;
      if (id.startsWith("@babel/runtime/")) return require(id);
      if (!(id in modules))
        throw Error(`Unexpected native rendering dependency: ${id}`);
      return modules[id];
    },
  });
  return exports;
}
function flatten(value: any): any {
  return Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten))
    : value || {};
}
describe("Android control rendering", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`preserves button geometry, colors and feedback in ${theme} mode`, () => {
      const ui = compile("src/components/ui.tsx", theme);
      for (const variant of ["primary", "secondary", "danger"]) {
        const button = ui.Button({
          title: "Save expense",
          onPress() {},
          variant,
        });
        expect(button.type).toBe(native.Pressable);
        expect(typeof button.props.style).toBe("function");
        const normal = flatten(button.props.style({ pressed: false }));
        const pressed = flatten(button.props.style({ pressed: true }));
        expect(normal.minHeight).toBeGreaterThanOrEqual(48);
        expect(normal.paddingHorizontal).toBeGreaterThanOrEqual(16);
        expect(normal.flexDirection).toBe("row");
        expect(normal.alignItems).toBe("center");
        expect(normal.justifyContent).toBe("center");
        expect(normal.backgroundColor).toMatch(/^#/);
        expect(pressed.opacity).toBeLessThan(normal.opacity);
        const label = button.props.children.props.children[1];
        expect(label.props.style.color).not.toBe(normal.backgroundColor);
      }
      const disabled = ui.Button({
        title: "Save expense",
        onPress() {},
        disabled: true,
      });
      expect(disabled.props.disabled).toBe(true);
      expect(
        flatten(disabled.props.style({ pressed: false })).opacity,
      ).toBeLessThan(1);
    });
    it(`preserves profile rows and icon touch areas in ${theme} mode`, () => {
      const ui = compile("src/components/ui.tsx", theme);
      const mobile = compile("src/components/mobile.tsx", theme, ui);
      const settings = compile("src/components/settings.tsx", theme, ui);
      const icon = mobile.IconButton({ label: "Edit profile", onPress() {} });
      const iconStyle = flatten(icon.props.style({ pressed: false }));
      expect(icon.type).toBe(native.Pressable);
      expect(iconStyle.width).toBeGreaterThanOrEqual(44);
      expect(iconStyle.height).toBeGreaterThanOrEqual(44);
      const row = settings.SettingsRow({
        title: "Notifications",
        onPress() {},
      });
      const rowStyle = row.props.style({ pressed: false });
      expect(row.type).toBe(native.Pressable);
      expect(rowStyle.minHeight).toBeGreaterThanOrEqual(48);
      expect(rowStyle.flexDirection).toBe("row");
      expect(rowStyle.paddingHorizontal).toBeGreaterThanOrEqual(16);
      expect(rowStyle.backgroundColor).toBe(tokens[theme].surface);
    });
  }
});
