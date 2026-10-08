// ?test=1 のときだけ、テスト用パネル（test.js）を読みこむ。全ページのいちばん最後に、これを1行入れてある（来場者のときは、何も読まない）。
// ページごとに動かせるもの（花火・メニュー・サイネージの画面送りなど）は、各ページが globalThis.kosenHooks に入れておく
if (new URLSearchParams(location.search).has("test")) import("./test.js").then(({ initTest }) => initTest()).catch(() => { /* 読めなければ、パネルなし */ });
