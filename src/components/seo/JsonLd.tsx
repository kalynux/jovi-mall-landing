import type { JsonLdNode } from "@/lib/seo/jsonld";

/**
 * Emits schema.org nodes as `application/ld+json`.
 *
 * Server component on purpose — structured data that only appears after
 * hydration is worth much less, since it has to survive the crawler's render
 * pass to be read at all.
 */
export default function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const nodes = Array.isArray(data) ? data : [data];

  return (
    <>
      {nodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Escaping `<` keeps a stray "</script>" inside product copy from
          // closing the tag early. JSON.stringify does not do this for us.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
