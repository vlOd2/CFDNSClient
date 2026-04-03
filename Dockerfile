FROM denoland/deno:latest

WORKDIR /app
COPY . .

RUN deno install

ENTRYPOINT ["deno", "task", "run"]
