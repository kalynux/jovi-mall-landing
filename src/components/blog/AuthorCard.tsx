import type { ResolvedAuthor } from "@/lib/blog/blog.types";
import { cn } from "@/lib/utils";

/**
 * Initials from a name, for authors with no avatar.
 *
 * Two words at most: "The WiMall team" should read "TW", not "TWT".
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ author, size }: { author: ResolvedAuthor; size: "sm" | "lg" }) {
  const box = size === "sm" ? "h-9 w-9 text-xs" : "h-12 w-12 text-sm";

  if (author.avatarUrl) {
    // Plain <img>: no author ships an avatar yet, so next.config carries no
    // remote host to point next/image at.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatarUrl}
        alt=""
        className={cn("flex-shrink-0 rounded-full object-cover", box)}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-role-soft font-display font-bold text-role",
        box
      )}
    >
      {initials(author.name)}
    </span>
  );
}

/**
 * The byline under an article headline.
 *
 * The machine-readable half of "who wrote this" is the `author` node in the
 * article's BlogPosting markup, not a microformat class here — so this is
 * plain, correct HTML and nothing more.
 */
export function AuthorByline({ author }: { author: ResolvedAuthor }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar author={author} size="sm" />
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-[var(--text-primary)]">
          {author.name}
        </p>
        <p className="text-xs text-[var(--text-muted)]">{author.title}</p>
      </div>
    </div>
  );
}

/** The fuller block at the foot of an article, with the bio. */
export default function AuthorCard({ author, label }: { author: ResolvedAuthor; label: string }) {
  return (
    <div className="card p-5 sm:p-6">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-4 flex gap-4">
        <Avatar author={author} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-[var(--text-primary)]">
            {author.name}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{author.title}</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{author.bio}</p>
        </div>
      </div>
    </div>
  );
}
