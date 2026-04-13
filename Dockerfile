FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY bin ./bin
COPY src ./src
COPY README.md ./

RUN chmod +x ./bin/api-mock-seeder.js

ENTRYPOINT ["node", "/app/bin/api-mock-seeder.js"]
CMD ["--help"]
