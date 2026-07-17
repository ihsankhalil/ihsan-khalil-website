import { writeFile } from "node:fs/promises";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_MEDIA_BUCKET = "media",
  OUTPUT_FILE = "public-content.js",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt als GitHub Secret."
  );
}

const endpoint = new URL("/rest/v1/content_items", SUPABASE_URL);
endpoint.searchParams.set(
  "select",
  [
    "id",
    "type",
    "status",
    "title",
    "subtitle",
    "excerpt",
    "quote",
    "body",
    "closing_question",
    "publish_at",
    "category",
    "tags",
    "image_path",
    "location",
    "link",
    "created_at",
    "updated_at",
  ].join(",")
);
endpoint.searchParams.set("status", "eq.Veröffentlicht");
endpoint.searchParams.set("order", "publish_at.desc.nullslast,updated_at.desc");

const response = await fetch(endpoint, {
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: "application/json",
  },
});

if (!response.ok) {
  throw new Error(
    `Supabase-Abfrage fehlgeschlagen (${response.status}): ${await response.text()}`
  );
}

const now = new Date();
const rawItems = await response.json();

const items = rawItems
  .filter((item) => item.type !== "buch")
  .filter((item) => !item.publish_at || new Date(item.publish_at) <= now)
  .map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title ?? "",
    subtitle: item.subtitle ?? "",
    excerpt: item.excerpt ?? "",
    quote: item.quote ?? "",
    body: item.body ?? "",
    closingQuestion: item.closing_question ?? "",
    publishAt: item.publish_at,
    category: item.category ?? "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    imagePath: item.image_path ?? "",
    imageUrl: item.image_path
      ? `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/${encodeURI(item.image_path)}`
      : "",
    location: item.location ?? "",
    link: item.link ?? "",
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));

const payload = {
  generatedAt: now.toISOString(),
  count: items.length,
  items,
};

const output =
  "/* Automatisch durch ZENON CMS erzeugt. Nicht manuell bearbeiten. */\n" +
  `window.IDK_CONTENT = ${JSON.stringify(payload, null, 2)};\n`;

await writeFile(OUTPUT_FILE, output, "utf8");

console.log(`${items.length} öffentliche Inhalte nach ${OUTPUT_FILE} geschrieben.`);
