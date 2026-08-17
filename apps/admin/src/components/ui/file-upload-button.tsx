'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export interface FileUploadButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  className?: string;
  /** Button text — swap it for "Uploading…" while a request is in flight. */
  label?: React.ReactNode;
}

/**
 * Styled stand-in for the browser's native "Choose file / No file chosen"
 * control, which every *-upload-field.tsx used to render raw and unstyled.
 * Reuses buttonVariants so it looks exactly like every other button in the
 * app, applied to a <label> wrapping a visually-hidden <input type="file"> —
 * the standard accessible pattern (native click-to-open/keyboard/screen-
 * reader behavior, no click-forwarding JS needed).
 */
export const FileUploadButton = React.forwardRef<HTMLInputElement, FileUploadButtonProps>(
  ({ className, label = 'Choose Image', id, disabled, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        data-slot="file-upload-button"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), disabled && 'pointer-events-none opacity-50', 'gap-1.5', className)}
      >
        <Upload className="size-3.5" />
        {label}
        <input ref={ref} id={id} type="file" disabled={disabled} className="sr-only" {...props} />
      </label>
    );
  },
);
FileUploadButton.displayName = 'FileUploadButton';
