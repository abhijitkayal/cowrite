import { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`border border-black px-3 py-2 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
