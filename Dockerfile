FROM node:alpine3.18
RUN npm install -g pnpm

WORKDIR /app
COPY src src
COPY package.json .
COPY tsconfig.json .
RUN pnpm install

CMD ["npm", "start"]
