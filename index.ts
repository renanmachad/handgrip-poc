import indexHtml from "./views/index.html";
import trainingHtml from "./views/training.html";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": indexHtml,
    "/training": trainingHtml
  }
});

console.log(`Server is running on ${server.url}`);  
