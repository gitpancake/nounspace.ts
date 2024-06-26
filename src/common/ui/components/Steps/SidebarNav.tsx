import React from "react";
import { Button } from "@/common/ui/atoms/button";
import { classNames } from "@/styles/utils/css";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { findIndex } from "lodash";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    key: string;
    idx: number;
    title: string;
  }[];
  step: string;
  onClick: (string) => void;
}

export function SidebarNav({
  className,
  items,
  step,
  onClick,
  ...props
}: SidebarNavProps) {
  const getIdxForStep = (step: string) => {
    return findIndex(items, (item) => item.key === step);
  };
  const currentStepIdx = getIdxForStep(step);

  return (
    <nav
      className={classNames(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
        className!
      )}
      {...props}
    >
      {items.map((item) => {
        const enabled = item.idx <= currentStepIdx;
        return (
          <Button
            onClick={() => onClick(item.key)}
            key={item.key}
            variant="ghost"
            // disabled={!enabled}
            className={classNames(
              enabled ? "text-foreground/40 hover:bg-transparent hover:underline" : "",
              item.key === step ? "bg-muted hover:bg-muted" : "",
              "justify-start truncate"
            )}
          >
            {item.title}
            <div className="flex-shrink-0 ml-2">
              {item.idx < currentStepIdx && (
                <CheckCircleIcon
                  className="h-6 w-6 text-green-600"
                  aria-hidden="true" />
              )}
            </div>
          </Button>
        );
      })}
    </nav>
  );
}
