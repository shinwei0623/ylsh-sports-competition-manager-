/** Minimal TEST shell. No student data and no writes. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('體育競賽管理系統｜TEST');
}
function healthCheck() {
  return { ok: true, build: 'test-scaffold-0.1', time: new Date().toISOString() };
}
