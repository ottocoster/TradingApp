import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CandlestickController } from 'chartjs-chart-financial';
import { map, take, tap } from 'rxjs';

export interface Kraken {
  error: any[];
  result: Result;
}

export interface Result {
  XXBTZUSD: Array<string[]>;
  last: number;
}

export type data = number | string;

export interface Candle {
  o: string;
  h: string;
  l: string;
  c: string;
  x: number;
}

@Injectable({
  providedIn: 'root',
})
export class QuotesService {
  quotes: Kraken | undefined;

  constructor(private httpClient: HttpClient) {}

  getQuotes() {
    return this.httpClient.get<Kraken>('http://localhost:3000/').pipe(
      tap((_) => console.log(_)),
      take(1),
      map((k: Kraken) => this.map(k))
    );
  }

  map(quotes: Kraken) {
    return quotes.result.XXBTZUSD?.map((candle) => {
      return {
        o: parseFloat(candle[1]),
        h: parseFloat(candle[2]),
        l: parseFloat(candle[3]),
        c: parseFloat(candle[4]),
        x: parseFloat(candle[0]) * 1000,
      };
    });
  }
}
