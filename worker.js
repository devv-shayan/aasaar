// AASAAR site: send www to the bare domain, then serve the static files.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.aasaar.tech') {
      url.hostname = 'aasaar.tech';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
