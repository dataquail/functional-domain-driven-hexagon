<script module lang="ts">
  import type { Snippet } from "svelte";

  export type DialogProps = {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description?: string;
    readonly children?: Snippet;
    /** Actions, rendered bottom-right on wide viewports. */
    readonly footer?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";

  import { CloseIcon } from "./icon/icons";

  const {
    children,
    "data-testid": testId,
    description,
    footer,
    onOpenChange,
    open,
    title,
  }: DialogProps = $props();
</script>

<DialogPrimitive.Root bind:open={() => open, onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      class="fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      data-slot="dialog-content"
      data-testid={testId}
      class="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg"
    >
      <div class="flex flex-col gap-2 text-center sm:text-left">
        <DialogPrimitive.Title class="text-lg leading-none font-semibold">
          {title}
        </DialogPrimitive.Title>
        {#if description !== undefined}
          <DialogPrimitive.Description class="text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        {/if}
      </div>

      {@render children?.()}

      {#if footer !== undefined}
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {@render footer()}
        </div>
      {/if}

      <DialogPrimitive.Close
        aria-label="Close"
        class="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden"
      >
        <CloseIcon size="md" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
