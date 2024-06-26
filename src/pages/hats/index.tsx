import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/common/ui/atoms/separator";
import StepSequence from "@/common/ui/components/Steps/StepSequence";
import { Button } from "@/common/ui/atoms/button";
import { Input } from "@/common/ui/atoms/input";
import { Label } from "@/common/ui/atoms/label";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import { useAccount, useReadContract } from "wagmi";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Avatar, AvatarFallback, AvatarImage } from "@/common/ui/atoms/avatar";
import BigOptionSelector from "@/common/ui/components/BigOptionSelector";
import SharedAccountOwnershipSetup from "@/common/ui/components/SharedAccountOwnershipSetup";
import TransferAccountToHatsDelegator from "@/common/ui/components/TransferAccountToHatsDelegator";
import { openWindow } from "@/common/lib/utils/navigation";
import { ID_REGISTRY } from "@/constants/contracts/id-registry";
import { isEmpty } from "lodash";
import clsx from "clsx";
import SwitchWalletButton from "@/common/ui/components/SwitchWalletButton";
import { Loading } from "@/common/ui/components/Loading";
import { APP_FID } from "@/constants/app";

enum HatsSignupNav {
  select_account = "SELECT_ACCOUNT",
  hats_protocol_setup = "HATS_PROTOCOL_SETUP",
  hats_tree = "HATS_TREE",
  account_ownership = "ACCOUNT_OWNERSHIP",
  transfer_ownership = "TRANSFER_OWNERSHIP",
  invite = "INVITE",
}

const hatsSignupSteps = [
  {
    title: "Select account",
    idx: 0,
    key: HatsSignupNav.select_account,
  },
  {
    title: "Hats Protocol setup",
    idx: 1,
    key: HatsSignupNav.hats_protocol_setup,
  },
  {
    title: "Account ownership",
    idx: 2,
    key: HatsSignupNav.account_ownership,
  },
  {
    title: "Transfer ownership",
    idx: 3,
    key: HatsSignupNav.transfer_ownership,
  },
  {
    title: "Invite others",
    idx: 4,
    key: HatsSignupNav.invite,
  },
];

export default function HatsProtocolPage() {
  const [step, setStep] = useState<string>(hatsSignupSteps[0].key);
  const [accountToTransfer, setAccountToTransfer] = useState<User | null>();
  const [delegatorContractAddress, setDelegatorContractAddress] = useState<
    `0x${string}` | null
  >();
  const [infoMessage, setInfoMessage] = useState<string | null>();
  const [didClickCopyShare, setDidClickCopyShare] = useState(false);
  const { address, isConnected } = useAccount();
  const [userInput, setUserInput] = useState<string>("");
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const shareWithOthersText = `Join my shared Farcaster account with delegator contract
  address ${delegatorContractAddress} and FID ${accountToTransfer?.fid}`;

  const { data: fidOfUser, error: idOfUserError } = useReadContract({
    ...ID_REGISTRY,
    functionName: address ? "idOf" : undefined,
    args: address ? [address] : undefined,
  });

  const fetchUser = async () => {
    if (!userInput) return;

    setIsLoadingAccount(true);
    try {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      let fid: number | undefined;
      const isNumeric = /^-?\d+$/.test(userInput);
      if (isNumeric) {
        fid = Number(userInput);
        const res = await neynarClient.fetchBulkUsers([fid], {
          viewerFid: APP_FID,
        });
        console.log("res", res);
        setAccountToTransfer(res?.users?.[0]);
      } else {
        const res = await neynarClient.searchUser(userInput, parseInt(APP_FID));
        console.log("res", res);
        setAccountToTransfer(res.result?.users?.[0]);
      }
    } catch (error) {
      console.error(error);
      setInfoMessage("User not found, please try again");
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const getStepContent = (
    title: string,
    description: string,
    children?: ReactNode
  ) => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      {children}
    </div>
  );

  const renderUserInputForm = () => (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Input
          className="w-72"
          placeholder="Nounspace"
          value={userInput}
          onChange={(e) => {
            if (accountToTransfer) setAccountToTransfer(null);
            if (infoMessage) setInfoMessage(null);
            setUserInput(e.target.value);
          }}
        />
        <Button
          className="w-1/3"
          variant={accountToTransfer ? "outline" : "default"}
          onClick={fetchUser}
        >
          Search
        </Button>
      </div>
      <Label>
        Enter the username or FID of the account you want to share with others.
      </Label>
      {accountToTransfer && renderAccountToTransferPreview()}
      {isLoadingAccount && <Loading />}
    </div>
  );

  const renderAccountToTransferPreview = () =>
    accountToTransfer && (
      <div className="mb-4 space-x-4 grid grid-cols-2 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2">
          <Avatar className="h-14 w-14">
            <AvatarImage alt="User avatar" src={accountToTransfer.pfp_url} />
            <AvatarFallback>
              {accountToTransfer.username || accountToTransfer.fid}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <h2 className="text-xl font-bold text-foreground">
              {accountToTransfer?.display_name}
            </h2>
            <span className="text-sm text-foreground/80">
              @{accountToTransfer?.username} · fid: {accountToTransfer?.fid}
            </span>
          </div>
        </div>
      </div>
    );

  const renderSelectAccount = () => {
    return getStepContent(
      "Select account",
      "You need to connect your wallet to select a Farcaster account to share",
      <div className="flex flex-col space-y-8 w-1/2">
        <SwitchWalletButton />
        {renderUserInputForm()}
        {infoMessage && (
          <p className="text-sm text-foreground/70">{infoMessage}</p>
        )}
        <Button
          className="w-1/3"
          variant="default"
          disabled={!isConnected || !accountToTransfer}
          onClick={() => setStep(HatsSignupNav.hats_protocol_setup)}
        >
          Continue
        </Button>
      </div>
    );
  };

  const renderInvite = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col">
          <p className="text-lg text-semibold">
            Successfully created your shared Farcaster account 🥳
          </p>
          <p className="text-muted-foreground">
            All users with the Caster Hat in their wallet can now join!
          </p>
          <div className="mt-4 flex justify-between">
            <p className="text-foreground/70">
              Share this to invite other users:
            </p>
            <div className="flex flex-row space-x-2">
              {didClickCopyShare && (
                <p className="text-muted-foreground">Copied!</p>
              )}
              <ClipboardDocumentIcon
                className={clsx(
                  "h-5 w-5 ",
                  didClickCopyShare
                    ? "animate-pulse text-muted-foreground"
                    : "text-foreground"
                )}
                onClick={() => {
                  setDidClickCopyShare(true);
                  navigator.clipboard.writeText(shareWithOthersText);
                  setTimeout(() => {
                    setDidClickCopyShare(false);
                  }, 2000);
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-4">
            <p className="text-foreground py-2 px-3 bg-muted rounded-lg">
              {shareWithOthersText}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = (step: string) => {
    switch (step) {
      case HatsSignupNav.select_account:
        return renderSelectAccount();
      case HatsSignupNav.hats_protocol_setup:
        return getStepContent(
          "Hats Protocol setup",
          "Setup your Hats tree and deploy a delegator contract",
          <div>
            {accountToTransfer && renderAccountToTransferPreview()}
            <BigOptionSelector
              options={[
                {
                  title: "I have created a Hats tree",
                  description: "Continue with the setup in Nounspace",
                  buttonText: "I have a Hats tree",
                  disabled: isEmpty(accountToTransfer),
                  onClick: () => setStep(HatsSignupNav.account_ownership),
                },
                {
                  title: "I need a new Hats tree",
                  description:
                    "Start your setup with Hats Protocol in the Hats app",
                  buttonText: "Get started ↗️",
                  onClick: () =>
                    openWindow(" https://app.hatsprotocol.xyz/trees/new"),
                },
              ]}
            />
          </div>
        );
      case HatsSignupNav.account_ownership:
        return getStepContent(
          "Account ownership",
          "Decide where the Farcaster account will be owned and managed",
          <div>
            {accountToTransfer && renderAccountToTransferPreview()}
            <SharedAccountOwnershipSetup
              onSuccess={() => setStep(HatsSignupNav.transfer_ownership)}
              delegatorContractAddress={delegatorContractAddress}
              setDelegatorContractAddress={setDelegatorContractAddress}
            />
          </div>
        );
      case HatsSignupNav.transfer_ownership:
        return getStepContent(
          "Transfer ownership",
          "Send your Farcaster account to the delegator contract",
          <div>
            {accountToTransfer && renderAccountToTransferPreview()}
            <TransferAccountToHatsDelegator
              user={accountToTransfer}
              onSuccess={() => setStep(HatsSignupNav.invite)}
              toAddress={delegatorContractAddress!}
            />
          </div>
        );
      case HatsSignupNav.invite:
        return getStepContent(
          "Invite others",
          "Let other users join your shared account",
          renderInvite()
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="space-y-6 p-4 pb-16 block">
        <StepSequence
          title="Create a shared Farcaster account"
          description="powered by Hats Protocol 🧢"
          step={step}
          setStep={setStep}
          navItems={hatsSignupSteps}
          renderStep={renderStep}
        />
      </div>
    </div>
  );
}
