export function getAppMetaTitle(defaultTitle: string) {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true"
    ? "VLTX CRM"
    : defaultTitle;
}
