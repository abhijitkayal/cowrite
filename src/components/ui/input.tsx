import { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`border border-black px-3 py-2 ${className}`}
      {...props}
    />
  );
}
