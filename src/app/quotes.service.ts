import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Subject, take } from 'rxjs';
import { FinancialDataPoint } from 'chart.js';

export const symbol = 'XBT/USD';

export interface KrakenResponse {
  error: any[];
  result: Result;
}

export interface Result {
  XXBTZUSD: Array<string[]>;
  last: number;
}

export interface Candle {
  x: number;
  o: string;
  h: string;
  l: string;
  c: string;
}

@Injectable({
  providedIn: 'root',
})
export class QuotesService {
  quotes: KrakenResponse | undefined;
  streamingQuotes = new Subject();
  streamingQuotes$ = this.streamingQuotes.asObservable();

  constructor(private httpClient: HttpClient) {}

  getHistoricalPrices() {
    return this.httpClient.get<KrakenResponse>('http://localhost:3000/').pipe(
      take(1),
      map((krakenResponse: KrakenResponse) => this.mapToCandle(krakenResponse))
    );
  }

  mapToCandle(quotes: KrakenResponse): FinancialDataPoint[] {
    return quotes.result.XXBTZUSD?.map((candle) => {
      return {
        x: parseFloat(candle[0]) * 1000, // timestamp in seconds to ms
        o: parseFloat(candle[1]),
        h: parseFloat(candle[2]),
        l: parseFloat(candle[3]),
        c: parseFloat(candle[4]),
      };
    });
  }

  startStreamingLivePrices() {
    const ws = new WebSocket('wss://ws.kraken.com	');

    ws.addEventListener('open', (event) => {
      ws.send(
        JSON.stringify({
          event: 'subscribe',
          pair: [symbol],
          subscription: {
            interval: 1,
            name: 'ohlc',
          },
        })
      );
    });

    ws.addEventListener('message', (event) => {
      this.streamingQuotes.next(event.data);
    });
  }

  parseStream(candle: string[]): FinancialDataPoint {
    return {
      x: parseFloat(candle[1]) * 1000,
      o: parseFloat(candle[2]),
      h: parseFloat(candle[3]),
      l: parseFloat(candle[4]),
      c: parseFloat(candle[5]),
    };
  }
}
