import * as SecureStore from "expo-secure-store";
// A/B slots prevent a killed write from corrupting the last complete cache.
export async function readCached(key: string): Promise<string | null> {
  const slot = await SecureStore.getItemAsync(`${key}.slot`);
  if (!slot) return null;
  const count = Number(await SecureStore.getItemAsync(`${key}.${slot}.count`));
  if (!count || count > 80) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.getItemAsync(`${key}.${slot}.${i}`),
    ),
  );
  return parts.every((p) => p !== null) ? parts.join("") : null;
}
export async function writeCached(key: string, value: string) {
  if (value.length > 100000) return;
  const old = await SecureStore.getItemAsync(`${key}.slot`),
    slot = old === "a" ? "b" : "a";
  const previous =
    Number(await SecureStore.getItemAsync(`${key}.${slot}.count`)) || 0;
  const parts = value.match(/[\s\S]{1,1400}/g) || [];
  for (let i = 0; i < parts.length; i++)
    await SecureStore.setItemAsync(`${key}.${slot}.${i}`, parts[i]!, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  await SecureStore.setItemAsync(`${key}.${slot}.count`, String(parts.length));
  await SecureStore.setItemAsync(`${key}.slot`, slot);
  for (let i = parts.length; i < previous; i++)
    await SecureStore.deleteItemAsync(`${key}.${slot}.${i}`);
}
export async function removeCached(key: string) {
  await SecureStore.deleteItemAsync(`${key}.slot`);
  for (const slot of ["a", "b"]) {
    const count =
      Number(await SecureStore.getItemAsync(`${key}.${slot}.count`)) || 0;
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${slot}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.${slot}.count`);
  }
}
