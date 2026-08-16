import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type ThemeIllustrationProps = Omit<ImageProps, "src"> & {
  src: string;
  darkSrc?: string;
};

function withDarkSuffix(src: string): string {
  const dot = src.lastIndexOf(".");
  if (dot === -1) return `${src}-dark`;
  return `${src.slice(0, dot)}-dark${src.slice(dot)}`;
}

/**
 * Light and dark artwork for the landing illustrations. Both sit in the DOM
 * so a class-based theme switch doesn't wait on a fetch; `dark:hidden` /
 * `hidden dark:block` keeps only the active one painted (and in the a11y tree).
 */
export function ThemeIllustration({
  src,
  darkSrc,
  alt,
  className,
  ...rest
}: ThemeIllustrationProps) {
  const dark = darkSrc ?? withDarkSuffix(src);
  return (
    <>
      <Image src={src} alt={alt} className={cn("dark:hidden", className)} {...rest} />
      <Image
        src={dark}
        alt={alt}
        className={cn("hidden dark:block", className)}
        {...rest}
      />
    </>
  );
}
