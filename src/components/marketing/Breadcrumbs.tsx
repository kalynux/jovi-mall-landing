import { Link } from "@/i18n/navigation";

/**
 * The visible half of the breadcrumb; `breadcrumbJsonLd()` emits the machine
 * half from the same trail, so the two cannot describe different paths.
 *
 * The last crumb is the current page and is not a link — it carries
 * `aria-current="page"` instead.
 */
export default function Breadcrumbs({
  trail,
  label,
}: {
  trail: { name: string; path: string }[];
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;

          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="text-[var(--text-secondary)]">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.path}
                    className="transition-colors hover:text-[var(--text-primary)]"
                  >
                    {crumb.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
