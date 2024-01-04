import { Server } from "socket.io";
import { sql } from "./db";
import type { Row, ReplicationEvent } from "postgres";
const io = new Server({
  cors: {
    origin: "*",
  },
});
const subEventsFilter = (
  subEvents: string,
  row: Row,
  replicationEvent: ReplicationEvent
) => {
  const schema = replicationEvent.relation.schema;
  const table = replicationEvent.relation.table;
  const eventName = subEvents.split(";");

  if (eventName.length == 0) {
    return [];
  }
  return eventName.filter((it) => {
    if (it === "*") return true;
    if (it.indexOf(":") < 0) return false;
    const info = it.split(":");
    const op = info[0];
    if (op !== "*" && op !== replicationEvent.command) return false;
    const tableInfos = info.slice(1).join("").split("=");
    const ns =
      tableInfos[0].indexOf(".") > 0
        ? tableInfos[0]
        : `public.${tableInfos[0]}`;
    if (ns !== "*" && ns !== `${schema}.${table}`) return false;

    if (tableInfos.length === 1 && ns === `${schema}.${table}`) return true;

    if (
      tableInfos.length > 1 &&
      tableInfos.slice(1).join("") ===
        replicationEvent.relation.keys.map((it) => row?.[it.name]).join(",")
    )
      return true;
    return false;
  });
};

const handlerAccount = (row: Row, replicationEvent: ReplicationEvent) => {
  const schema = replicationEvent.relation.schema;
  const table = replicationEvent.relation.table;
  const keys = replicationEvent.relation.keys;
  const sockets = io.of("/account").sockets.values();

  for (const socket of sockets) {
    sql.begin(async (sql) => {
      await sql`select set_config('role', 'account', true);`;
      await sql`select set_config('request.jwt.claims', ${JSON.stringify(
        socket.data.claims
      )}::text, true);`;

      const res = await sql`
            select exists (select 1 from 
                ${sql(schema)}.${sql(table)} where 
                ${keys
                  .map((it) => sql`${sql(it.name)} = ${row?.[it.name]}`)
                  .reduce((x, y) => sql`${x} and ${y}`)} 
                );`;

      if (res?.[0].exists) {
        socket.emit(`${schema}.${table}`, row, {
          ...replicationEvent,
          relation: undefined,
        });
      }

      await sql`select set_config('role', null, true);`;
      await sql`select set_config('request.jwt.claims',null, true);`;
    });
  }
};

const handlerAnon = (row: Row, replicationEvent: ReplicationEvent) => {
  const schema = replicationEvent.relation.schema;
  const table = replicationEvent.relation.table;
  const keys = replicationEvent.relation.keys;

  const sockets = io.of("/anon").sockets.values();

  for (const socket of sockets) {
    sql.begin(async (sql) => {
      await sql`select set_config('role', 'anon', true);`;
      const res = await sql`
            select exists (select 1 from 
                ${sql(schema)}.${sql(table)} where 
                ${keys
                  .map((it) => sql`${sql(it.name)} = ${row?.[it.name]}`)
                  .reduce((x, y) => sql`${x} and ${y}`)} 
                );`;

      if (res?.[0].exists) {
        socket.emit(`${schema}.${table}`, row, {
          ...replicationEvent,
          relation: undefined,
        });
      }

      await sql`select set_config('role', null, true);`;
    });
  }
};
sql.subscribe("*", (row, replicationEvent) => {
  const keys = replicationEvent.relation.keys;
  if (keys.length === 0) {
    return;
  }

  if (row) {
    Promise.all([
      handlerAccount(row, replicationEvent),
      handlerAnon(row, replicationEvent),
    ]);
  }
});

export default io;

io.listen(3000);
