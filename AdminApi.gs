/** Minimal API: only expose admin controls to verified account. */
function getAdminBootstrap(){
  const p=getDemoDataPreview();
  return {build:'test-demo-0.2',demo:p};
}
