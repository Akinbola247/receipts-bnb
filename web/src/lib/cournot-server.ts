import "server-only";

export const COURNOT_UPSTREAM = "https://interface.cournot.ai/intelligence/v1";

/** Partner key issued by Cournot (server env). Optional: without it the server's free quota is used. */
export const SERVER_COURNOT_KEY = process.env.COURNOT_API_KEY || "";
