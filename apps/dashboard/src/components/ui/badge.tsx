import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Same tones as logic-app/lib/core/widgets/status_chip.dart (StatusTone).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[--radius-chip] px-2 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        info: "bg-[--info-bg] text-[--info-fg]",
        success: "bg-[--success-bg] text-[--success]",
        warning: "bg-[--warning-bg] text-[--warning]",
        neutral: "bg-[--neutral-bg] text-[--neutral-fg]",
        danger: "bg-[--destructive-bg] text-[--destructive]",
        outline: "border border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
