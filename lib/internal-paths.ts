/**
 * The parts of the site that are the shop's own staff, not its customers.
 *
 * Kept in a module of its own because both a server and a browser need it, and
 * where it used to live — lib/google-analytics — signs a JWT with node:crypto.
 * Importing one constant from there pulled the whole module into the browser
 * bundle and the build stopped: "Reading from node:crypto is not handled".
 *
 * Anything under these paths is left out of the visitor counts and out of the
 * speed measurements. Admin is used from a desk on wifi, and counting it would
 * drag every average towards a speed no customer ever sees.
 */
export const INTERNAL_PATH_PREFIXES = ["/admin", "/worker"] as const;
