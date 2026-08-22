import * as DialogPrimitive from "@radix-ui/react-dialog";

import { CloseIcon } from "./icon";

// A modal. Radix owns focus trapping, scroll locking and the escape/overlay
// dismissals; this file owns the shape a screen may ask for. The close affordance
// is not optional -- a modal you cannot dismiss is a bug, not a variant.

export type DialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: React.ReactNode;
  /** Actions, rendered bottom-right on wide viewports. */
  readonly footer?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Dialog: React.FC<DialogProps> = ({
  children,
  "data-testid": testId,
  description,
  footer,
  onOpenChange,
  open,
  title,
}) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} data-slot="dialog">
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-testid={testId}
        className="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg"
      >
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <DialogPrimitive.Title className="text-lg leading-none font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description !== undefined && (
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>

        {children}

        {footer !== undefined && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        )}

        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden"
        >
          <CloseIcon size="md" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export { Dialog };
