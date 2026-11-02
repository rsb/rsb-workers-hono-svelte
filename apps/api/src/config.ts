// Configuration is data the api reads and checks at startup: plain values that
// vary by deployment, like limits, URLs and flags. The api has none yet; the
// first arrives soon. Bindings such as D1 are not configuration: the platform
// hands them over already configured and built, so they go straight to
// `constructInfra`.
