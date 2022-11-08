import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Subject, take } from 'rxjs';
import { FinancialDataPoint } from 'chart.js';

export interface Kraken {
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
  quotes: Kraken | undefined;
  streamingQuotes = new Subject();
  streamingQuotes$ = this.streamingQuotes.asObservable();

  constructor(private httpClient: HttpClient) {}

  getQuotes() {
    return this.httpClient.get<Kraken>('http://localhost:3000/').pipe(
      take(1),
      map((k: Kraken) => this.map(k))
    );
  }

  map(quotes: Kraken): FinancialDataPoint[] {
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

  startStreamingQuotes() {
    const ws = new WebSocket('wss://ws.kraken.com	');

    ws.addEventListener('open', (event) => {
      ws.send(
        JSON.stringify({
          event: 'subscribe',
          pair: ['XBT/USD'],
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
}
