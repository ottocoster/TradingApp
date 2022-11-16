const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function getData() {
  const url = await fetch("https://api.kraken.com/0/public/OHLC?pair=XBTUSD");
  const j = await url.json();
  return j;
}

const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(cors());

app.get("/", async (req, res) => {
  res.send(await getData());
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
