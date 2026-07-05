import { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`border border-black px-3 py-2 ${className}`}
      {...props}
    />
  );
}
