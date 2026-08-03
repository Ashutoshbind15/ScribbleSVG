import { cn } from '@/lib/cn';

type BrandProps = {
  className?: string;
  priority?: boolean;
};

/**
 * Square app mark (dark badge + scribble S). Used for favicon / share previews.
 */
export function BrandAppIcon({ className }: BrandProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/icon.svg"
      alt="ScribbleSVG"
      width={32}
      height={32}
      className={cn('h-8 w-8 rounded-[22%]', className)}
    />
  );
}

/**
 * Compact abbreviation mark for the navbar (large S + svg).
 * SVG uses currentColor ink; via <img> that resolves to black — invert in dark mode.
 */
export function BrandMark({ className }: BrandProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/ssvg.svg"
      alt="ScribbleSVG"
      width={120}
      height={56}
      className={cn('h-8 w-auto dark:invert', className)}
    />
  );
}

/** Full scribble wordmark for the home header / hero. */
export function BrandWordmark({ className }: BrandProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/scribblesvg.svg"
      alt="ScribbleSVG"
      width={280}
      height={54}
      className={cn('h-12 w-auto sm:h-14 dark:invert', className)}
    />
  );
}
