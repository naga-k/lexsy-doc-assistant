"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex flex-1 min-h-0", className)}
    initial="instant"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

type StickContextValue = ReturnType<typeof useStickToBottomContext>;
type ConversationContentChild = (context: StickContextValue) => ReactNode;

export const ConversationContent = ({
  className,
  children,
  style,
  ...props
}: ConversationContentProps) => {
  const context = useStickToBottomContext();
  const hasAutoScrolled = useRef(false);
  const renderedChildren =
    typeof children === "function"
      ? (children as ConversationContentChild)(context)
      : children;

  useEffect(() => {
    if (hasAutoScrolled.current) {
      return;
    }
    hasAutoScrolled.current = true;
    context.scrollToBottom?.({ animation: "instant" });
  }, [context]);

  return (
    <div
      ref={context.scrollRef}
      style={{ height: "100%", width: "100%", ...style }}
      className="flex-1 min-h-0 overflow-y-auto"
      {...props}
    >
      <div
        ref={context.contentRef}
        className={cn("flex flex-col gap-8 p-4", className)}
      >
        {renderedChildren}
      </div>
    </div>
  );
};

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
