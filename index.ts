import indexHtml from "./views/index.html";

const server = Bun.serve({
    port: 3000,
    routes: {
        "/": indexHtml
    }
});

console.log(`Server is running on ${server.url}`);  