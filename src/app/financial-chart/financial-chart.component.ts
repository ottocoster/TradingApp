import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  FinancialDataPoint,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
} from 'chartjs-chart-financial';
import { enUS } from 'date-fns/locale';
import { BaseChartDirective } from 'ng2-charts';
import { concatMap, delay, filter, from, map, of } from 'rxjs';
import { QuotesService, symbol } from '../quotes.service';
import {
  findEntryPointLong,
  findEntryPointShort,
  findSupportAndResistance,
} from './indicators';

@Component({
  selector: 'app-financial-chart',
  templateUrl: './financial-chart.component.html',
  styleUrls: ['./financial-chart.component.css'],
})
export class FinancialChartComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBacktest = true; // Set to false for live trading
  skipGraph = false; // Optional, to not update the graph when backtesting
  stepTime = 2000; // Milliseconds waiting time after each step when backtesting
  profitTarget = 0.005; // Percentage in decimal notation
  stopLoss = 0.005; // Percentage in decimal notation
  barCount = 120; // Maximum of bars displayed in the graph
  hasPosition = false;
  openOrderLong: number | undefined;
  openOrderShort: number | undefined;
  takeProfitOrderLong: number | undefined;
  takeProfitOrderShort: number | undefined;
  entryPointLong: FinancialDataPoint | undefined;
  entryPointShort: FinancialDataPoint | undefined;
  runningPnl = 0; // Running profit and loss this session
  currentPnl = 0; // Current trade profit and loss
  holdPnl = 0; // Buy and hold profit and loss, used as benchmark
  stopLossOrderLong: number | undefined;
  stopLossOrderShort: number | undefined;
  now = new Date().toLocaleTimeString();
  public financialChartType: ChartType = 'candlestick';
  public financialChartData: ChartConfiguration['data'] = {
    datasets: [],
  };
  public financialChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    scales: {
      x: {
        time: {
          unit: 'day',
        },
        adapters: {
          date: {
            locale: enUS,
          },
        },
        ticks: {
          source: 'auto',
        },
      },
    },
    borderColor: 'black',
    backgroundColor: 'rgba(255, 0, 0, 0, 0.2)',
    plugins: {
      legend: {
        display: true,
      },
    },
  };

  constructor(private quotesService: QuotesService) {
    Chart.register(
      CandlestickController,
      OhlcController,
      CandlestickElement,
      OhlcElement
    );
  }

  ngOnInit(): void {
    this.subscribeToHistoricalPrices();

    if (!this.isBacktest) {
      this.subscribeToStreamingPrices();
    }
  }

  subscribeToHistoricalPrices() {
    this.quotesService.getHistoricalPrices().subscribe((candles) => {
      if (!this.isBacktest) {
        // Live trading
        this.startLiveTrading(candles);
      } else {
        // Backtesting
        // Take first part of historical prices for finding support and resistance
        const firstPart = candles.slice(0, this.barCount);
        const lastPart = candles.slice(this.barCount);

        this.renderHistoricalPrices(firstPart);

        // Take last part of historical prices for backtesting
        // Create stream which emits one candle every stepTime milliseconds
        from(lastPart)
          .pipe(concatMap((candle) => of(candle).pipe(delay(this.stepTime))))
          .subscribe((candle) => {
            const lines = findSupportAndResistance(
              this.chart?.data?.datasets[0].data as FinancialDataPoint[]
            );

            if (!this.hasPosition && this.chart?.data?.datasets[0].data) {
              this.entryPointLong = findEntryPointLong(candle, lines);
              this.entryPointShort = findEntryPointShort(candle, lines);
            }

            this.renderHistoricalClock(candle);
            this.paperTrade(candle, candles[0]);
            this.renderGraph(candle, lines);
          });
      }
    });
  }

  subscribeToStreamingPrices() {
    this.quotesService.streamingQuotes$
      .pipe(
        map((message) => {
          try {
            return JSON.parse(message as string);
          } catch (error) {}
        }),
        filter((message) => {
          try {
            return (message as Array<string>).pop() === symbol;
          } catch (error) {
            return false;
          }
        }),
        map((message) => {
          return this.quotesService.parseStream(message[1]);
        })
      )
      .subscribe((candle) => {
        const lines = findSupportAndResistance(
          this.chart?.data?.datasets[0].data as FinancialDataPoint[]
        );

        if (!this.hasPosition && this.chart?.data?.datasets[0].data) {
          this.entryPointLong = findEntryPointLong(candle, lines);
          this.entryPointShort = findEntryPointShort(candle, lines);
        }

        this.paperTrade(candle);
        this.renderGraph(candle, lines);
      });
  }

  startLiveTrading(candles: FinancialDataPoint[]) {
    this.renderLiveClock();
    this.renderHistoricalPrices(candles);
    this.quotesService.startStreamingLivePrices();
  }

  renderLiveClock() {
    setInterval(() => {
      this.now = new Date().toLocaleTimeString();
    }, 1000);
  }

  renderHistoricalClock(candle: FinancialDataPoint) {
    // Set clock to historical candle time
    this.now = new Date(candle.x).toLocaleTimeString();
  }

  renderHistoricalPrices(candles: FinancialDataPoint[]) {
    this.chart?.data?.datasets?.push({
      label: symbol,
      data: candles,
    });

    this.updateChart();
  }

  renderGraph(
    candle: FinancialDataPoint,
    lines: {
      supportLines: FinancialDataPoint[];
      resistanceLines: FinancialDataPoint[];
    }
  ) {
    const oldData = this.chart?.data?.datasets[0].data as FinancialDataPoint[];

    // Update existing candle if the new candle has the same end time
    const sameEndTime = oldData?.findIndex(
      (oldCandle) => (oldCandle as FinancialDataPoint).x === candle.x
    );

    if (sameEndTime && sameEndTime > -1 && oldData) {
      oldData[sameEndTime] = candle;
    } else {
      oldData?.push(candle);
    }

    this.chart?.data?.datasets ? (this.chart.data.datasets = []) : undefined;

    this.chart?.data?.datasets?.push({
      label: symbol,
      data: oldData,
    });

    // Draw support lines
    !this.takeProfitOrderShort &&
      lines.supportLines?.forEach((supportLine) =>
        this.chart?.data?.datasets?.push({
          type: 'line',
          label: `Support line`,
          backgroundColor: 'rgba(0, 0, 255, 0.3)',
          borderColor: 'rgba(0, 0, 255, 0.8)',
          pointBackgroundColor: 'rgba(0, 0, 255, 0.8)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(0, 0, 255, 0.8)',
          borderWidth: 1,
          fill: false,
          data: [
            {
              x: supportLine.x,
              y: supportLine.l,
            },
            {
              x: Date.now(),
              y: supportLine.l,
            },
          ],
        })
      );

    // Draw resistance lines
    !this.takeProfitOrderLong &&
      lines.resistanceLines?.forEach((resistanceLine) =>
        this.chart?.data?.datasets?.push({
          type: 'line',
          label: `Resistance line`,
          backgroundColor: 'rgba(255, 0, 0, 0.3)',
          borderColor: 'rgba(255, 0, 0, 0.8)',
          pointBackgroundColor: 'rgba(255, 0, 0, 0.8)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(255, 0, 0, 0.8)',
          borderWidth: 1,
          fill: false,
          data: [
            {
              x: resistanceLine.x,
              y: resistanceLine.h,
            },
            {
              x: Date.now(),
              y: resistanceLine.h,
            },
          ],
        })
      );

    // Draw entry point LONG
    if (this.entryPointLong && !this.takeProfitOrderShort) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Entry point LONG`,
        backgroundColor: 'rgba(255, 192, 0, 0.3)',
        borderColor: 'rgba(255, 192, 0, 0.8)',
        pointBackgroundColor: 'rgba(255, 192, 0, 0.8)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 192, 0, 0.8)',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointLong.x,
            y: this.entryPointLong.l,
          },
          {
            x: Date.now(),
            y: this.entryPointLong.l,
          },
        ],
      });
    }

    // Draw entry point SHORT
    if (this.entryPointShort && !this.takeProfitOrderLong) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Entry point SHORT`,
        backgroundColor: 'rgba(255, 192, 0, 0.3)',
        borderColor: 'rgba(255, 192, 0, 0.8)',
        pointBackgroundColor: 'rgba(255, 192, 0, 0.8)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 192, 0, 0.8)',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointShort.x,
            y: this.entryPointShort.h,
          },
          {
            x: Date.now(),
            y: this.entryPointShort.h,
          },
        ],
      });
    }

    // Draw take profit order LONG
    if (this.takeProfitOrderLong && this.entryPointLong) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Take profit order LONG`,
        backgroundColor: 'rgba(0, 255, 0, 0.3)',
        borderColor: 'lightgreen',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointLong.x,
            y: this.takeProfitOrderLong,
          },
          {
            x: Date.now(),
            y: this.takeProfitOrderLong,
          },
        ],
      });
    }

    // Draw take profit order SHORT
    if (this.takeProfitOrderShort && this.entryPointShort) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Take profit order SHORT`,
        backgroundColor: 'rgba(0, 255, 0, 0.3)',
        borderColor: 'lightgreen',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointShort.x,
            y: this.takeProfitOrderShort,
          },
          {
            x: Date.now(),
            y: this.takeProfitOrderShort,
          },
        ],
      });
    }

    // Draw stop loss order LONG
    if (this.stopLossOrderLong && this.entryPointLong) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Stop Loss order LONG`,
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
        borderColor: 'darkred',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointLong.x,
            y: this.stopLossOrderLong,
          },
          {
            x: Date.now(),
            y: this.stopLossOrderLong,
          },
        ],
      });
    }

    // Draw stop loss order SHORT
    if (this.stopLossOrderShort && this.entryPointShort) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Stop Loss order SHORT`,
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
        borderColor: 'darkred',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPointShort.x,
            y: this.stopLossOrderShort,
          },
          {
            x: Date.now(),
            y: this.stopLossOrderShort,
          },
        ],
      });
    }

    this.updateChart();
  }

  updateChart() {
    if (
      this.chart?.data?.datasets[0]?.data?.length &&
      this.chart?.data?.datasets[0]?.data?.length > this.barCount
    ) {
      this.chart.data.datasets[0].data = this.chart.data.datasets[0].data.slice(
        -this.barCount
      );
    }

    this.skipGraph ? undefined : this.chart?.chart?.update();
  }

  paperTrade(lastCandle: FinancialDataPoint, firstCandle?: FinancialDataPoint) {
    this.holdPnl = (firstCandle && lastCandle.c - firstCandle?.c) ?? 0;

    if (this.hasPosition && this.openOrderLong) {
      this.currentPnl = lastCandle.c - this.openOrderLong;
    }

    if (this.hasPosition && this.openOrderShort) {
      this.currentPnl = this.openOrderShort - lastCandle.c;
    }

    if (
      this.openOrderLong &&
      this.hasPosition &&
      this.takeProfitOrderLong &&
      lastCandle.h >= this.takeProfitOrderLong
    ) {
      // console.log(
      //   `Take profit order LONG filled at ${
      //     this.takeProfitOrderLong
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );

      console.log(
        'LONG order profit:',
        this.takeProfitOrderLong - this.openOrderLong
      );

      this.runningPnl += this.takeProfitOrderLong - this.openOrderLong;

      this.reset();

      return;
    }

    if (
      this.openOrderShort &&
      this.hasPosition &&
      this.takeProfitOrderShort &&
      lastCandle.l <= this.takeProfitOrderShort
    ) {
      // console.log(
      //   `Take profit order SHORT filled at ${
      //     this.takeProfitOrderShort
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );

      console.log(
        'SHORT order profit:',
        this.openOrderShort - this.takeProfitOrderShort
      );

      this.runningPnl += this.openOrderShort - this.takeProfitOrderShort;

      this.reset();

      return;
    }

    if (
      this.openOrderLong &&
      this.hasPosition &&
      this.stopLossOrderLong &&
      lastCandle.l <= this.stopLossOrderLong
    ) {
      // console.log(
      //   `Stop loss order LONG filled at ${this.stopLossOrderLong} at ${new Date(
      //     lastCandle.x
      //   ).toLocaleTimeString()}`
      // );

      console.log(
        'LONG order profit:',
        this.stopLossOrderLong - this.openOrderLong
      );

      this.runningPnl += this.stopLossOrderLong - this.openOrderLong;

      this.reset();

      return;
    }

    if (
      this.openOrderShort &&
      this.hasPosition &&
      this.stopLossOrderShort &&
      lastCandle.h >= this.stopLossOrderShort
    ) {
      // console.log(
      //   `Stop loss order SHORT filled at ${
      //     this.stopLossOrderShort
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );

      console.log(
        'SHORT order profit:',
        this.openOrderShort - this.stopLossOrderShort
      );

      this.runningPnl += this.openOrderShort - this.stopLossOrderShort;

      this.reset();

      return;
    }

    if (
      this.entryPointLong &&
      this.openOrderLong &&
      !this.hasPosition &&
      lastCandle.l <= this.openOrderLong
    ) {
      this.hasPosition = true;
      this.takeProfitOrderLong =
        this.entryPointLong.l * (1 + this.profitTarget);
      this.stopLossOrderLong = this.entryPointLong.l * (1 - this.stopLoss);
      this.entryPointLong.x = lastCandle.x;
      this.entryPointLong.l = this.openOrderLong;

      // console.log(
      //   `Buy order LONG filled at ${this.openOrderLong} at ${new Date(
      //     lastCandle.x
      //   ).toLocaleTimeString()}`
      // );
      // console.log(
      //   `Creating take profit order LONG at ${
      //     this.takeProfitOrderLong
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );
      // console.log(
      //   `Creating stop loss order LONG at ${
      //     this.stopLossOrderLong
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );

      return;
    }

    if (
      this.entryPointShort &&
      this.openOrderShort &&
      !this.hasPosition &&
      lastCandle.h >= this.openOrderShort
    ) {
      this.hasPosition = true;
      this.takeProfitOrderShort =
        this.entryPointShort.h * (1 + this.profitTarget);
      this.stopLossOrderShort = this.entryPointShort.h * (1 - this.stopLoss);
      this.entryPointShort.x = lastCandle.x;
      this.entryPointShort.h = this.openOrderShort;

      // console.log(
      //   `Buy order SHORT filled at ${this.openOrderShort} at ${new Date(
      //     lastCandle.x
      //   ).toLocaleTimeString()}`
      // );
      // console.log(
      //   `Creating take profit SHORT order at ${
      //     this.takeProfitOrderShort
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );
      // console.log(
      //   `Creating stop loss SHORT order at ${
      //     this.stopLossOrderShort
      //   } at ${new Date(lastCandle.x).toLocaleTimeString()}`
      // );

      return;
    }

    // Create new buy order if there isn't any
    // Update order when entry point is updated
    if (
      !this.hasPosition &&
      this.entryPointLong &&
      (!this.openOrderLong || this.openOrderLong !== this.entryPointLong.l)
    ) {
      // console.log(
      //   `Creating buy order at ${this.entryPointLong.l} at ${new Date(
      //     lastCandle.x
      //   ).toLocaleTimeString()}`
      // );

      this.openOrderLong = this.entryPointLong.l;
    }

    // Create new sell order if there isn't any
    // Update order when entry point is updated
    if (
      !this.hasPosition &&
      this.entryPointShort &&
      (!this.openOrderShort || this.openOrderShort !== this.entryPointShort.h)
    ) {
      // console.log(
      //   `Creating sell order at ${this.entryPointShort.h} at ${new Date(
      //     lastCandle.x
      //   ).toLocaleTimeString()}`
      // );

      this.openOrderShort = this.entryPointShort.h;
    }
  }

  reset() {
    this.takeProfitOrderLong = undefined;
    this.takeProfitOrderShort = undefined;
    this.stopLossOrderLong = undefined;
    this.stopLossOrderShort = undefined;
    this.hasPosition = false;
    this.openOrderLong = undefined;
    this.openOrderShort = undefined;
  }
}
