module.exports = {
  routes: [
    {
      method: "POST",
      path: "/records/findTotalRecords",
      handler: "record.findTotalRecords",
    },
    {
      method: "POST",
      path: "/records/findMyRecords",
      handler: "record.findMyRecords",
    },
  ],
};
