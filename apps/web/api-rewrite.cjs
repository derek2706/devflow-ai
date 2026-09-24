/** A fixed server-side development target; never derived from a request host. */
function getApiInternalOrigin(value = "http://127.0.0.1:5001") {
  const invalid = () => new Error("Invalid API_INTERNAL_URL configuration");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.hostname.includes("*") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw invalid();
  }
  return url.origin;
}

function developmentApiRewrites(environment = process.env) {
  return environment.NODE_ENV === "development"
    ? [
        {
          source: "/api/:path*",
          destination: `${getApiInternalOrigin(environment.API_INTERNAL_URL)}/api/:path*`,
        },
      ]
    : [];
}
module.exports = { developmentApiRewrites, getApiInternalOrigin };
