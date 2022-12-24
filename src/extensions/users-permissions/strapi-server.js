module.exports = (plugin) => {
  // controller
  plugin.controllers.user.updateMe = async (ctx) => {
    if (!ctx.state.user || !ctx.state.user.id) {
      return (ctx.response.status = 401);
    }

    ctx.params = { id: ctx.state.user.id };
    return await strapi.plugins["users-permissions"]
      .controller("user")
      .update(ctx);
  };

  // route
  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/me/update",
    handler: "user.updateMe",
    config: {
      prefix: "",
      policies: [],
    },
  });

  return plugin;
};
