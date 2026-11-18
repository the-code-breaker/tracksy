import { authFlow } from "./auth-flow";
const memory = new Map<string, string>();
const lifetime = 7 * 86400000;
export const browserStorage = {
  async getItem(key: string) {
    try {
      return await authFlow.get(`app:${key}`);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      await authFlow.set(`app:${key}`, value, lifetime);
    } catch {
      /* Private/restricted browsers keep this tab's session in memory. */
    }
  },
  async removeItem(key: string) {
    memory.delete(key);
    try {
      await authFlow.remove(`app:${key}`);
    } catch {}
  },
};
