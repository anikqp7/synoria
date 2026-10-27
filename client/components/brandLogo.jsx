import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({ href = "/", className = "" }) {
  return (
    <Link href={href} aria-label="Synoria home" className={`inline-flex h-12 shrink-0 items-center ${className}`}>
      <span className="relative block w-[184px] shrink-0 max-[480px]:w-40">
        <Image src="/brand/synoriaWordmark.png" alt="Synoria" width={1983} height={793} sizes="(max-width: 480px) 160px, 184px" priority className="h-auto w-full dark:brightness-0 dark:invert" />
        {/* Preserve the original blue mark over the white dark-mode wordmark. */}
        <Image src="/brand/synoriaWordmark.png" alt="" aria-hidden="true" width={1983} height={793} sizes="(max-width: 480px) 160px, 184px" loading="eager" className="pointer-events-none absolute inset-0 hidden h-auto w-full [clip-path:inset(0_73.5%_0_0)] dark:block" />
      </span>
    </Link>
  );
}
