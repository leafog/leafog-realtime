import postgres from "postgres";
const port = Number.parseInt(process.env.PG_PORT) || 54325;
const host = process.env.PG_HOST || "localhost";
const database = process.env.PG_DB || "postgres";
const user = process.env.PG_USER || "postgres";
const pass = process.env.PG_PASS || "postgres";

export const sql = postgres({
  port,
  host,
  database,
  user,
  pass,
  publications: "leafog_realtime",
}); // will default to the same as psql
