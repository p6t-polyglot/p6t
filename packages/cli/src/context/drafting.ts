export const DESCRIPTION_GUIDANCE =
  "Write a short translator's brief grounded in the product docs and representative UI. " +
  "Name the people using the product and the jobs they do. Explain product concepts only where their meaning changes the wording: " +
  "for example, 'A workspace is the shared container members join, not a personal dashboard.' " +
  "Keep facts that help interpret a message; leave out marketing claims, implementation details, and locale-specific term mappings.";

export const STYLE_GUIDE_GUIDANCE =
  "Use approved copy and reviewed translations as evidence, not isolated or unreviewed strings. " +
  "Write each rule as a trigger, a preferred choice, and a real or representative target-language example. " +
  "For example: 'Button labels: use no final period (Änderungen speichern). " +
  "Errors that are complete sentences: keep the final period (Die Datei konnte nicht geöffnet werden.).' " +
  "Treat examples here as illustrations, not universal defaults. " +
  "Delete any rule that wouldn't change a plausible translation; leave ordinary language conventions to the translator.";

export const DRAFTING_GUIDE = {
  inspect:
    "Read product docs, representative screens and their source messages, and any reviewed target copy. " +
    "Find the configured description and locale guides. Preserve existing authored decisions; propose changes separately.",
  description: DESCRIPTION_GUIDANCE,
  styleGuide: STYLE_GUIDE_GUIDANCE,
  review:
    "If evidence is missing or conflicts on a consequential choice (such as German du vs. Sie), " +
    "show the reviewer the competing examples and ask; leave the choice out of the guide until settled. " +
    "Before handing off, check that every rule changes an actual translation choice and every claimed preference has evidence or approval. " +
    "Keep approved source-to-target term mappings in the locale glossary.",
};
