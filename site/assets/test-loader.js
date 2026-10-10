if (new URLSearchParams(location.search).has("test")) import("./test.js").then(({ initTest }) => initTest()).catch(() => {  });
