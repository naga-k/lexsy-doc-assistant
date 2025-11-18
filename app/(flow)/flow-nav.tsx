import Image from "next/image";
import Link from "next/link";

export function FlowNav() {
  return (
    <nav className="lexsy-nav shrink-0">
      <div className="mx-auto flex w-full items-center px-4 py-3 sm:px-5">
        <Link href="/" className="inline-flex items-center">
          <span className="sr-only">Back to Lexsy home</span>
          <Image
            src="https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/671dd7da409351203f94af52_Lexsy.png"
            alt="Lexsy"
            width={155}
            height={40}
            className="h-7 w-auto"
            priority={false}
            unoptimized
          />
        </Link>
      </div>
    </nav>
  );
}
