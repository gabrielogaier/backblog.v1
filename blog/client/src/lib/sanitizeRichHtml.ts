import sanitizeHtml from "sanitize-html";
import markdownProfile from "@/config/markdownProfile.json";

const configuredHeadingTags = (markdownProfile.headings?.allowedLevels ?? [2, 3])
  .filter((level): level is number => Number.isInteger(level) && level >= 1 && level <= 6)
  .map((level) => `h${level}`);

const allowedHeadingTags = configuredHeadingTags.length ? configuredHeadingTags : ["h2", "h3"];
const tableTags = markdownProfile.tables?.enabled ? ["table", "thead", "tbody", "tr", "th", "td"] : [];

const allowedTags = sanitizeHtml.defaults.allowedTags
  .filter((tag) => !/^h[1-6]$/.test(tag))
  .concat(allowedHeadingTags, ["img", ...tableTags]);

const allowedSchemes = sanitizeHtml.defaults.allowedSchemes.filter((scheme) => scheme !== "data");

export function sanitizeRichHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes,
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https"],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs };
        if (next.target === "_blank") {
          const relTokens = new Set((next.rel || "").split(/\s+/).filter(Boolean));
          relTokens.add("noopener");
          relTokens.add("noreferrer");
          next.rel = Array.from(relTokens).join(" ");
        }
        return { tagName, attribs: next };
      },
    },
  });
}

export function rewriteStorageAssetUrls(html: string, assetOrigin: string) {
  return html.replace(/src="(?:https?:\/\/[^/"]+)?(\/storage[^"]*)"/gi, (_match, filePath: string) => {
    const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `src="${assetOrigin}${normalized}"`;
  });
}
