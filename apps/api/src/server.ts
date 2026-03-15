import app from "./app.js";
import "./db/database.js";

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
