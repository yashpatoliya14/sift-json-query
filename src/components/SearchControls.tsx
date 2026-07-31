import { ArrowIcon, SearchIcon } from "@/components/icons";
import { LightningZap } from "@/components/LightningZap";
import { cn } from "@/lib/utils";
import type { SearchScope } from "@/lib/types";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  scope: SearchScope;
  onScopeChange: (s: SearchScope) => void;
  caseSensitive: boolean;
  onCaseToggle: () => void;
  regex: boolean;
  onRegexToggle: () => void;
  matchCount: number;
  activeIndex: number;
  onStep: (delta: number) => void;
  ms: number | null;
  error: string | null;
  translated: string | null;
}

const SCOPES: SearchScope[] = ["keys", "values", "both"];

export function SearchControls({
  query,
  onQueryChange,
  scope,
  onScopeChange,
  caseSensitive,
  onCaseToggle,
  regex,
  onRegexToggle,
  matchCount,
  activeIndex,
  onStep,
  ms,
  error,
  translated,
}: Props) {
  return (
    <div className="border-b border-border bg-panel">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div
          className={cn(
            "flex min-w-[220px] flex-1 items-center gap-2 border bg-background px-2",
            error ? "border-destructive" : "border-border focus-within:border-brass",
          )}
        >
          <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onStep(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder={'text, /regex/, or { "age": { "$gt": 20 } }'}
            aria-label="Search keys and values"
            className="w-full bg-transparent py-1.5 font-mono text-[12px] text-foreground placeholder:text-t-null focus:outline-none"
          />
          {query && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {matchCount ? `${activeIndex + 1}/${matchCount}` : "0"}
            </span>
          )}
        </div>

        <div className="flex items-center">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onScopeChange(s)}
              aria-pressed={scope === s}
              className={cn(
                "border border-border px-2 py-1.5 font-mono text-[10px] tracking-wide transition-colors not-first:border-l-0",
                scope === s
                  ? "bg-brass text-background"
                  : "text-muted-foreground hover:text-brass",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <Toggle active={caseSensitive} onClick={onCaseToggle} label="Case sensitive">
          Aa
        </Toggle>
        <Toggle active={regex} onClick={onRegexToggle} label="Regular expression">
          .*
        </Toggle>

        <div className="flex items-center">
          <StepButton onClick={() => onStep(-1)} disabled={!matchCount} label="Previous match" up />
          <StepButton onClick={() => onStep(1)} disabled={!matchCount} label="Next match" />
        </div>

        <LightningZap ms={query ? ms : null} label="search" />
      </div>

      {(error || translated) && (
        <div className="border-t border-border px-3 py-1.5 font-mono text-[10px]">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <span className="text-muted-foreground">
              translated → <span className="text-t-string">SELECT * FROM data {translated}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        "border px-2 py-1.5 font-mono text-[10px]",
        active
          ? "border-brass bg-brass text-background"
          : "border-border text-muted-foreground hover:text-brass",
      )}
    >
      {children}
    </button>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  up,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  up?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border border-border p-1.5 text-muted-foreground transition-colors hover:text-brass disabled:opacity-35 disabled:hover:text-muted-foreground",
        !up && "border-l-0",
      )}
    >
      <ArrowIcon className={cn("h-3.5 w-3.5", up && "rotate-180")} />
    </button>
  );
}
