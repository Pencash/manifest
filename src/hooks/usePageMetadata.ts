import { useEffect } from "react";

interface PageMetadataOptions {
  title?: string;
  description?: string;
  canonicalPath?: string;
}

const ensureMetaTag = (
  attribute: "name" | "property",
  value: string,
  content: string
) => {
  const selector = `meta[${attribute}='${value}']`;
  let tag = document.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
};

const ensureCanonicalLink = (href: string) => {
  let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
};

export const usePageMetadata = ({
  title,
  description,
  canonicalPath,
}: PageMetadataOptions) => {
  useEffect(() => {
    const baseTitle = "Manifest Giving Platform";
    const resolvedTitle = title ? `${title} | ${baseTitle}` : baseTitle;
    const resolvedDescription =
      description ||
      "Securely manage giving, testimonies, attendance, and pastoral care through the Manifest Giving Platform.";

    const canonicalUrl = canonicalPath
      ? `${window.location.origin}${canonicalPath}`
      : window.location.href;

    document.title = resolvedTitle;

    ensureMetaTag("name", "description", resolvedDescription);
    ensureMetaTag("property", "og:title", resolvedTitle);
    ensureMetaTag("property", "og:description", resolvedDescription);
    ensureMetaTag("property", "og:url", canonicalUrl);
    ensureMetaTag("name", "twitter:title", resolvedTitle);
    ensureMetaTag("name", "twitter:description", resolvedDescription);

    ensureCanonicalLink(canonicalUrl);
  }, [canonicalPath, description, title]);
};
