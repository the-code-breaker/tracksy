import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound, Link as LinkIcon } from "lucide-react-native";
import { rpc, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useInvitation } from "../lib/state";
import { invitationToken } from "../lib/group-mail";
import {
  Screen,
  Card,
  Label,
  Field,
  Button,
  TextLink,
  ErrorBox,
  Loading,
  useColors,
} from "../components/ui";
export default function Join() {
  const params = useLocalSearchParams<{ token?: string }>(),
    pending = useInvitation((s) => s.token),
    remember = useInvitation((s) => s.setToken),
    { session } = useAuth(),
    cache = useQueryClient(),
    c = useColors();
  const [input, setInput] = useState(params.token || pending || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const token = invitationToken(input);
  const preview = useQuery({
    queryKey: ["invitation-preview", token],
    enabled: !!token,
    queryFn: () =>
      rpc<{
        group_name: string;
        inviter: string;
        expires_at: string;
        email_bound: boolean;
        already_member?: boolean;
      }>("invitation_preview", { p_token: token }),
    retry: false,
  });
  return (
    <Screen title="Join a group" back>
      {!params.token && !pending && (
        <Field
          label="Invitation link"
          placeholder="Paste the link your friend shared"
          leading={<LinkIcon size={18} color={c.muted} />}
          value={input}
          onChangeText={(v) => {
            setInput(v);
            setError("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      {preview.isFetching ? (
        <Loading />
      ) : preview.error ? (
        <ErrorBox message={preview.error.message} />
      ) : preview.data ? (
        <Card style={{ gap: 16, padding: 24, alignItems: "center" }}>
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 23,
              backgroundColor: c.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UsersRound size={32} color={c.primary} />
          </View>
          <Label size={24} weight="700" style={{ textAlign: "center" }}>
            {preview.data.group_name}
          </Label>
          <Label size={14} muted style={{ textAlign: "center" }}>
            {preview.data.inviter} invited you to share expenses.
          </Label>
          <Label size={12} muted style={{ textAlign: "center" }}>
            Joining does not include you in earlier expenses.
          </Label>
        </Card>
      ) : (
        <Card>
          <Label muted size={14}>
            Open an invitation from your email, or paste a shared invitation
            link above.
          </Label>
        </Card>
      )}
      {preview.data?.email_bound && (
        <Label size={12} muted>
          Use the email address that received this invitation.
        </Label>
      )}
      <Label size={12} muted>
        Signed in as {session?.user.email}
      </Label>
      {preview.data && (
        <Button
          title={preview.data.already_member ? "Open group" : "Join group"}
          loading={busy}
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            remember(token);
            try {
              const id = await rpc<string>("accept_invitation", {
                p_token: token,
              });
              await cache.invalidateQueries();
              remember(undefined);
              router.replace(`/group/${id}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {error && <ErrorBox message={error} />}
      <TextLink
        title="Switch account"
        onPress={async () => {
          remember(token || undefined);
          const r = await supabase.auth.signOut({ scope: "local" });
          if (r.error) setError(r.error.message);
          else router.replace("/auth");
        }}
      />
      <TextLink
        title="Not now"
        onPress={() => {
          remember(undefined);
          router.replace("/");
        }}
      />
    </Screen>
  );
}
