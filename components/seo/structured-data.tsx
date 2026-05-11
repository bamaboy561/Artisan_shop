import type { JsonLdData } from "@/lib/seo";

type StructuredDataProps = {
  data: JsonLdData | JsonLdData[];
};

function safeJsonLd(data: JsonLdData) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function StructuredData({ data }: StructuredDataProps) {
  const items = Array.isArray(data) ? data : [data];

  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(item) }}
        />
      ))}
    </>
  );
}
