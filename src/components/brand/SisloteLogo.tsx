import { cn } from "@/lib/utils";

const LOGO_HORIZONTAL = "/lp/assets/brand/sislote-logo-horizontal.png";
const LOGO_SYMBOL = "/lp/assets/brand/sislote-simbolo.png";
const LOGO_NEGATIVE = "/lp/assets/brand/sislote-logo-fundo-escuro.png";

type SisloteLogoProps = {
  variant?: "horizontal" | "symbol" | "negative";
  className?: string;
  alt?: string;
};

export function SisloteLogo({
  variant = "horizontal",
  className,
  alt = "SISLOTE",
}: SisloteLogoProps) {
  const src = variant === "symbol"
    ? LOGO_SYMBOL
    : variant === "negative"
      ? LOGO_NEGATIVE
      : LOGO_HORIZONTAL;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("block object-contain", className)}
      decoding="async"
    />
  );
}
