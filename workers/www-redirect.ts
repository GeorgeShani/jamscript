/** Redirect before asset serving or authentication so every www URL is canonical. */
export default {
  fetch(request: Request): Response {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    destination.hostname = "jamscript.dev";
    destination.port = "";
    return Response.redirect(destination.href, 308);
  },
};
