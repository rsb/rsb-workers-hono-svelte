import { construct } from "./construct.ts";
import { serve } from "./http.ts";

// Once per isolate: build everything, then wire it to HTTP.
// There is no config yet: no environment value is read.
const api = construct();

export default serve(api);
