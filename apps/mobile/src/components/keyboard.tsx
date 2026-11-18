import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
// Web follows visualViewport resizing in the hosted shell. Native resolves the
// matching .native file so its focused inputs track the system keyboard.
export const FormScroll = ScrollView;
export const KeyboardFrame = View;
export function KeyboardRoot({ children }: PropsWithChildren) {
  return children;
}
