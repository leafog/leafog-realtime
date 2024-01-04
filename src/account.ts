import io from "./socket";

import * as jose from "jose";
const JWK_URL =
  process.env.JWK_URL ||
  "http://localhost/auth/realms/leafog/protocol/openid-connect/certs";

const JWKS = jose.createRemoteJWKSet(new URL(JWK_URL));

const handlerToken = async (token: string) => {
  if (token === undefined) {
    return undefined;
  }
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      audience: "account",
    });
    return payload;
  } catch (_error) {
    return undefined;
  }
};

io.of("/account").use(async (socket, next) => {
  const payload = await handlerToken(socket.handshake.auth.token);
  if (payload) {
    socket.data.claims = payload;
    next();
  } else {
    next(new Error("no auth"));
  }
});
