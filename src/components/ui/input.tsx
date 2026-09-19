import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-xl border border-white/12 bg-ink-950/70 px-4 py-2 text-sm text-white shadow-inset transition-colors",
        "placeholder:text-ink-400/80",
        "focus-visible:border-gold-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-red-500/60 aria-[invalid=true]:ring-red-500/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[110px] w-full rounded-xl border border-white/12 bg-ink-950/70 px-4 py-3 text-sm text-white shadow-inset transition-colors",
      "placeholder:text-ink-400/80",
      "focus-visible:border-gold-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em] text-gold-200/90",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

const FieldHint = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-xs leading-relaxed text-ink-400", className)}>{children}</p>
);

const FieldError = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  if (!children) return null;
  return (
    <p className={cn("text-xs font-medium text-red-300", className)} role="alert">
      {children}
    </p>
  );
};

export { Input, Textarea, Label, FieldHint, FieldError };