import React, { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/24/solid";
import {
  JoinedNounspacePostDraft,
  useNewPostStore,
} from "@/common/data/stores/useNewPostStore";
import { hydrate, useAccountStore } from "@/common/data/stores/useAccountStore";
import { isEmpty } from "lodash";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/constants/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/common/ui/atoms/card";
import { Button } from "@/common/ui/atoms/button";
import { QrCode } from "@/common/ui/components/QrCode";
import ConnectFarcasterAccountViaHatsProtocol from "@/common/ui/components/ConnectFarcasterAccountViaHatsProtocol";
import { useAccount } from "wagmi";
import {
  WarpcastLoginStatus,
  callCreateSignerRequest,
  createSignerRequest,
  generateWarpcastSigner,
  getWarpcastSignerStatus,
} from "@/common/data/api/warpcastLogin";
import HelpCard from "@/common/ui/components/HelpCard";
import { useIsMounted } from "@/common/lib/hooks/useIsMounted";
import { useRouter } from "next/router";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import ConfirmOnchainSignerButton from "@/common/ui/components/ConfirmOnchainSignerButton";
import SwitchWalletButton from "@/common/ui/components/SwitchWalletButton";
import { APP_FID } from "@/constants/app";
import SignupForNonLocalAccountCard from "@/common/ui/organisms/SignupForNonLocalAccountCard";

enum SignupStateEnum {
  "initial",
  "connecting",
  "done",
}

type SignupStepType = {
  state: SignupStateEnum;
  title: string;
  description: string;
  idx: number;
};

const SignupSteps: SignupStepType[] = [
  {
    state: SignupStateEnum.initial,
    title: "Start adding Farcaster accounts",
    description: "Get started with Nounspace",
    idx: 0,
  },
  {
    state: SignupStateEnum.connecting,
    title: "Connect account",
    description: "Connect your Farcaster account to Nounspace",
    idx: 1,
  },
  {
    state: SignupStateEnum.done,
    title: "Start casting",
    description: "Start casting and browsing your feed",
    idx: 2,
  },
];

export default function Accounts() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();

  const { accounts, addAccount, setAccountActive } = useAccountStore();

  const { addNewPostDraft } = useNewPostStore();

  const hasActiveAccounts =
    accounts.filter(
      (account) =>
        account.status === AccountStatusType.active &&
        account.platform !== AccountPlatformType.farcaster_local_readonly
    ).length > 0;
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );
  const hasOnlyLocalAccounts =
    accounts.length &&
    accounts.every(
      (account) =>
        account.platform === AccountPlatformType.farcaster_local_readonly
    );
  const hasPendingNewAccounts = pendingAccounts.length > 0;
  const pendingAccount = hasPendingNewAccounts ? pendingAccounts[0] : null;

  const [signupState, setSignupState] = useState<SignupStateEnum>(
    SignupStateEnum.initial
  );

  useEffect(() => {
    if (pendingAccount && signupState === SignupStateEnum.connecting) {
      pollForSigner();
    }
  }, [signupState, pendingAccount, isMounted]);

  useEffect(() => {
    if (hasPendingNewAccounts && signupState === SignupStateEnum.initial) {
      setSignupState(SignupStateEnum.connecting);
    }
  }, [signupState, hasPendingNewAccounts]);

  const onCreateNewAccount = async () => {
    const { publicKey, privateKey, signature, requestFid, deadline } =
      await generateWarpcastSigner();
    const { token, deeplinkUrl } = await callCreateSignerRequest({
      publicKey,
      requestFid,
      signature,
      deadline,
    });

    try {
      setIsLoading(true);
      await addAccount({
        account: {
          id: null,
          platformAccountId: undefined,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster,
          publicKey,
          privateKey,
          data: { signerToken: token, deeplinkUrl },
        },
      });
      setIsLoading(false);
      setSignupState(1);
    } catch (e) {
      console.log("error when trying to add account", e);
      setIsLoading(false);
    }
  };

  const checkStatusAndActiveAccount = async (pendingAccount) => {
    if (!pendingAccount?.data?.signerToken) return;

    const { status, data } = await getWarpcastSignerStatus(
      pendingAccount.data.signerToken
    );
    console.log("checked signer status: ", status, data);
    if (status === WarpcastLoginStatus.success) {
      const fid = data.userFid;
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (await neynarClient.fetchBulkUsers([fid], {viewerFid: APP_FID})).users[0];
      await setAccountActive(pendingAccount.id, user.username, {
        platform_account_id: user.fid.toString(),
        data,
      });
      await hydrate();
      window.location.reload();
    }
  };

  const pollForSigner = async () => {
    let tries = 0;
    while (tries < 60) {
      tries += 1;
      await new Promise((r) => setTimeout(r, 2000));
      checkStatusAndActiveAccount(pendingAccount);

      if (!isMounted()) return;
    }
  };

  const onStartCasting = () => {
    addNewPostDraft(JoinedNounspacePostDraft);
    router.push("/post");
  };

  const renderCreateSignerStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          Connect your Farcaster account
        </CardTitle>
        <CardDescription>
          Connect with Nounspace to see and publish casts
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          variant="default"
          onClick={() => onCreateNewAccount()}
        >
          <UserPlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
          {isLoading ? "Creating account..." : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderConnectAccountStep = () => {
    if (isEmpty(pendingAccounts)) return null;

    return (
      <div className="grid grid-cols-1 gap-4">
        <div className="h-fit">
          <Card className="bg-background text-foreground">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">
                Sign in with Web3 wallet
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Pay with ETH on Optimism to connect with Nounspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isConnected ? (
                <ConfirmOnchainSignerButton account={pendingAccount} />
              ) : (
                <SwitchWalletButton />
              )}
            </CardContent>
            <CardFooter></CardFooter>
          </Card>
        </div>
        <div className="relative mx-4">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-sm text-foreground/80">
              OR
            </span>
          </div>
        </div>
        <Card className="bg-background text-foreground">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in with Warpcast</CardTitle>
            <CardDescription className="text-muted-foreground">
              Pay with Warps in Warpcast to connect with Nounspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span>
              Scan the QR code with your mobile camera app to sign in via
              Warpcast.
            </span>
            <QrCode
              deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${pendingAccount?.data?.signerToken}`}
            />
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDoneStep = () => (
    <Card className="min-w-max bg-background text-foreground">
      <CardHeader className="space-y-1">
        <CardTitle className="flex">
          <CheckCircleIcon
            className="-mt-0.5 mr-1 h-5 w-5 text-foreground/80"
            aria-hidden="true"
          />
          Account added to Nounspace
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          You can start casting and browsing your feed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 -my-1.5 flex">
          <Button
            onClick={() => router.push("/feed")}
            type="button"
            variant="default"
          >
            Scroll your feed
            <NewspaperIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            onClick={() => onStartCasting()}
            type="button"
            variant="outline"
            className="ml-4"
          >
            Start casting
            <PlusCircleIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            onClick={() => router.push("/channels")}
            type="button"
            className="ml-4"
            variant="outline"
          >
            Pin your favourite channels
            <RectangleGroupIcon
              className="ml-1.5 mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCreateNewOnchainAccountCard = () => (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create a new Farcaster account onchain</CardTitle>
        <CardDescription>
          No need to connect with Warpcast. 
          Sign up directly with the Farcaster protocol onchain.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Button
            variant="default"
            onClick={() => router.push("/farcaster-signup")}
          >
            Create new account
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="m-4 flex flex-col gap-5">
      {(hasActiveAccounts || signupState === SignupStateEnum.done) &&
        renderDoneStep()}
      <div className="w-full flex flex-col gap-5">
        {hasOnlyLocalAccounts ? (
          <div className="flex">
            <SignupForNonLocalAccountCard />
          </div>
        ) : (
          <>
            <div className="max-w-md lg:max-w-lg">
              {signupState === SignupStateEnum.initial &&
                renderCreateSignerStep()}
              {signupState === SignupStateEnum.connecting &&
                renderConnectAccountStep()}
            </div>
            <div className="flex flex-col max-w-md lg:max-w-lg gap-5">
              {renderCreateNewOnchainAccountCard()}
              <HelpCard />
            </div>
            <ConnectFarcasterAccountViaHatsProtocol />
          </>
        )}
      </div>
    </div>
  );
}
