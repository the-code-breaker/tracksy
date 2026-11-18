import { browserStorage } from "./browser-storage";
export const readCached = (key: string) =>
  browserStorage.getItem(`cache:${key}`);
export const writeCached = (key: string, value: string) =>
  browserStorage.setItem(`cache:${key}`, value);
export const removeCached = (key: string) =>
  browserStorage.removeItem(`cache:${key}`);
