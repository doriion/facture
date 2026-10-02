/**
 * Adresse d'expédition « Nom <adresse> » (RFC 5322), logique pure
 * testée : le nom est mis entre guillemets s'il contient un caractère
 * spécial, les guillemets et antislashs sont échappés.
 */
export function adresseExpediteur(nom: string | null | undefined, email: string): string {
  const n = (nom ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!n) return email;
  const sur = /^[A-Za-z0-9 À-ÿ'._-]+$/.test(n) ? n : `"${n.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `${sur} <${email}>`;
}
