# TradingApp

This project is an example of a cryptocurrency trading bot built with Angular, Chart.js and Node.js. It connects to the Kraken cryptocurrency exchange via a proxy server.

It is meant to be accompanied by the talk of Otto Coster (@ottocoster / ottocoster.com) on building an automated trading bot, given at the Van Lanschot Kempen Nerdconf 2022 in Amsterdam, the Netherlands. Don't expect to make any money using this bot.

## Proxy server

This project contains a Node.js proxy server in the `/proxy` folder. This just connects the Kraken REST API to avoid CORS errors when trying to connect from the Angular app.

Run `npm install` in the `/proxy` folder, then start the proxy server with `node kraken.js`

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.
