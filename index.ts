import indexHtml from "./views/index.html";
import trainingHtml from "./views/training.html";
import { datasetStats, saveSample } from "./server/dataset.ts";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": indexHtml,
    "/training": trainingHtml,
    "/api/samples": {
      GET: () => datasetStats(),
      POST: (request) => saveSample(request),
    },
  },
});

console.log(`Server is running on ${server.url}`);
