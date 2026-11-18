import type { PropsWithChildren } from "react";
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import type { ScrollViewProps, ViewProps } from "react-native";
export function KeyboardRoot({ children }: PropsWithChildren) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
export function KeyboardFrame(props: ViewProps) {
  return <KeyboardAvoidingView {...props} behavior="padding" />;
}
export function FormScroll(props: ScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      extraKeyboardSpace={12}
      {...props}
    />
  );
}
