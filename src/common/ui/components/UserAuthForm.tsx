import * as React from "react";

import { mergeClasses }from "@/common/lib/utils/mergeClasses";
import { Button } from "@/common/ui/atoms/button";
import { Input } from "@/common/ui/atoms/input";
import { Label } from "@/common/ui/atoms/label";
import { Loading } from "./Loading";
import { SignInButton, useProfile } from "@farcaster/auth-kit";
import { useEffect, useState } from "react";
import { createClient } from "../../data/database/supabase/clients/component";
import { useRouter } from "next/router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { usePostHog } from "posthog-js/react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/common/ui/atoms/form";
import {
  hydrate,
  hydrateChannels,
  useAccountStore,
} from "@/common/data/stores/useAccountStore";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { AccountPlatformType, AccountStatusType } from "../../../constants/accounts";
import { v4 as uuidv4 } from "uuid";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import { APP_FID } from "@/constants/app";

export type UserAuthFormValues = z.infer<typeof UserAuthFormSchema>;

const UserAuthFormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 8 characters.",
  }),
});

export function UserAuthForm({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>("");
  const supabase = createClient();
  const router = useRouter();
  const posthog = usePostHog();
  const { isAuthenticated, profile } = useProfile();

  const form = useForm<UserAuthFormValues>({
    resolver: zodResolver(UserAuthFormSchema),
    mode: "onSubmit",
  });

  const { addAccount } = useAccountStore();
  const setupLocalAccount = async () => {
    setIsLoading(true);
    const { fid } = profile;
    if (!fid) return;
    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    const users = (
      await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID })
    ).users;
    if (!users.length) {
      console.error("No users found for fid: ", fid);
      return;
    }

    const account = {
      name: profile.username,
      status: AccountStatusType.active,
      platform: AccountPlatformType.farcaster_local_readonly,
      platformAccountId: fid.toString(),
      user: users[0],
    };
    setUserMessage("Setting up local account...");
    await hydrateChannels();
    await addAccount({
      account,
      localOnly: true,
    });
    posthog.identify(uuidv4(), { isLocalOnly: true });

    setUserMessage("Setup done. Welcome to the Nounspace experience!");
    router.push("/Homebase");
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && profile) {
      setupLocalAccount();
    }
  }, [isAuthenticated, profile]);

  async function logIn() {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error("login error", error);
      setIsLoading(false);
      return;
    }

    posthog.identify(data?.user?.id, { email });
    await hydrate();
    router.push("/homebase");
    setIsLoading(false);
  }

  async function signUp() {
    if (!(await form.trigger())) return;

    setIsLoading(true);
    const { email, password } = form.getValues();
    const { data, error } = await supabase.auth.signUp({ email, password });
    console.log(data, error);

    if (error) {
      form.setError("password", {
        type: "manual",
        message: error.message,
      });
      console.error("signup error", error);
      setIsLoading(false);
      return;
    } else {
      posthog.identify(data?.user?.id, { email });
      router.push("/welcome");
      setIsLoading(false);
    }
  }

  async function resetPassword() {
    const { email } = form.getValues();
    if (!email) {
      form.setError("email", {
        type: "manual",
        message: "Email is required.",
      });
      return;
    }

    setIsLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/login`,
    });
    setUserMessage("Password reset email sent.");
    setIsLoading(false);
  }

  useHotkeys(Key.Enter, logIn, [form.getValues()], { enableOnFormTags: true });

  return (
    <div className={mergeClasses("grid gap-6", className)}>
      <Form {...form}>
        <form>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="vitalik@home.xyz"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Label className="sr-only" htmlFor="email">
                Email
              </Label>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="text-white"
                        placeholder="************"
                        disabled={isLoading}
                        autoComplete="current-password"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Label className="sr-only" htmlFor="password">
                Password
              </Label>
            </div>
            <Button
              type="button"
              size="lg"
              className="py-6 bg-[#7C65C1] hover:bg-[#6A4CA5]"
              disabled={isLoading}
              onClick={() => logIn()}
            >
              {isLoading ? <Loading /> : "Sign In with Email"}
            </Button>
            <div className="flex items-center justify-center space-x-2">
              <Button
                type="button"
                variant="outline"
                className="text-gray-100 border-gray-500 w-full"
                disabled={isLoading}
                onClick={() => signUp()}
              >
                Signup
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-gray-100 border-gray-500 w-full"
                disabled={isLoading}
                onClick={() => resetPassword()}
              >
                Forgot Password?
              </Button>
            </div>
          </div>
        </form>
      </Form>
      <div className="text-center">
        {userMessage && <Label className="text-gray-200">{userMessage}</Label>}
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-gray-900 px-2 text-muted-foreground">
            or continue with
          </span>
        </div>
      </div>
      <div className="flex flex-col space-y-4 items-center justify-center text-white">
        {!isAuthenticated && !isLoading ? (
          <SignInButton hideSignOut />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="py-4 text-white bg-[#7C65C1] rounded-md"
            disabled={isLoading}
          >
            <Loading />
          </Button>
        )}
      </div>
    </div>
  );
}
