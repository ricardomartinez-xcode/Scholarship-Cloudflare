import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  sizes?: string;
};

function logoClassName(className?: string) {
  return ["select-none object-contain", className].filter(Boolean).join(" ");
}

export function UnidepLogo({
  className,
  priority = false,
  sizes,
}: BrandLogoProps) {
  return (
    <Image
      src="/branding/logo-unidep.png"
      alt="UNIDEP"
      width={1040}
      height={344}
      priority={priority}
      sizes={sizes}
      className={logoClassName(className)}
    />
  );
}

export function RecalcFullLogo({
  className,
  priority = false,
  sizes,
}: BrandLogoProps) {
  return (
    <Image
      src="/branding/logo-recalc.png"
      alt="ReCalc"
      width={1238}
      height={348}
      priority={priority}
      sizes={sizes}
      className={logoClassName(className)}
    />
  );
}

export function RecalcIconLogo({
  className,
  priority = false,
  sizes,
}: BrandLogoProps) {
  return (
    <Image
      src="/icons/icon48.png"
      alt="ReCalc"
      width={48}
      height={48}
      priority={priority}
      sizes={sizes}
      className={logoClassName(className)}
    />
  );
}
