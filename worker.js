import { onRequest as handleApi } from "./functions/api/[[path]].js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return handleApi({
        request,
        env,
        params: { path: url.pathname.replace(/^\/api\/?/, "") },
        data: {},
        waitUntil: ctx.waitUntil.bind(ctx),
        next: () => env.ASSETS.fetch(request)
      });
    }
    return env.ASSETS.fetch(request);
  }
};
