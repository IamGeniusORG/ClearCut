import { useId } from "react";

interface ClearCutLogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
}

export function ClearCutLogo({
  size = 40,
  showWordmark = true,
  subtitle,
}: ClearCutLogoProps) {
  const gradId = useId();

  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_6px_16px_rgba(16,185,129,0.25)]"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="4"
            y1="2"
            x2="36"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill={`url(#${gradId})`} />
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="35"
          rx="9.5"
          stroke="#ffffff"
          strokeOpacity="0.25"
        />
        <path
          d="M27.07 12.93A10 10 0 1 0 27.07 27.07"
          stroke="#09090b"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <path
          d="M23.25 16.75A4.6 4.6 0 1 0 23.25 23.25"
          stroke="#09090b"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark && (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white sm:text-lg">
              Clear<span className="text-emerald-400">Cut</span>
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300 uppercase">
              AI
            </span>
          </div>
          {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
