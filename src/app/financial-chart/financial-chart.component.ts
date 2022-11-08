import { Component, OnInit, ViewChild } from '@angular/core';
import 'chartjs-adapter-date-fns';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  FinancialDataPoint,
} from 'chart.js';
import { enUS } from 'date-fns/locale';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
} from 'chartjs-chart-financial';
import { QuotesService } from '../quotes.service';
import { delay, filter, map } from 'rxjs';

@Component({
  selector: 'app-financial-chart',
  templateUrl: './financial-chart.component.html',
  styleUrls: ['./financial-chart.component.css'],
})
export class FinancialChartComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  profitTarget = 0.005;
  stopLoss = 0.005;
  barCount = 240;
  hasPosition = false;
  openOrder: number | undefined;
  takeProfitOrder: number | undefined;
  entryPoint: FinancialDataPoint | undefined;
  runningPnl: number | undefined;
  stopLossOrder: number | undefined;
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
    backgroundColor: 'rgba(255,0,0,0,0.3)',
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
    setInterval(() => {
      this.now = new Date().toLocaleTimeString();
    }, 1000);

    this.quotesService
      .getQuotes()
      .pipe(delay(2000))
      .subscribe((candles) => {
        this.renderHistoricalPrices(candles);

        this.quotesService.startStreamingQuotes();
      });

    this.quotesService.streamingQuotes$
      .pipe(
        map((message) => {
          try {
            return JSON.parse(message as string);
          } catch (error) {}
        }),
        filter((message) => {
          try {
            return (message as Array<string>).pop() === 'XBT/USD';
          } catch (error) {
            return false;
          }
        }),
        map((message) => {
          return this.mapStream(message[1]);
        })
      )
      .subscribe((message) => {
        this.renderGraph(message);
      });
  }

  renderHistoricalPrices(candles: FinancialDataPoint[]) {
    this.chart?.data?.datasets?.push({
      label: 'XBT/USD',
      data: candles.slice(-this.barCount),
    });
    this.chart?.chart?.update();
  }

  renderGraph(message: FinancialDataPoint) {
    const oldData = this.chart?.data?.datasets[0].data as FinancialDataPoint[];
    const sameEndTime = oldData?.findIndex(
      (candle) => (candle as FinancialDataPoint).x === message.x
    );

    if (sameEndTime && sameEndTime > -1 && oldData) {
      oldData[sameEndTime] = message;
    } else {
      oldData?.push(message);
    }

    this.chart?.data?.datasets ? (this.chart.data.datasets = []) : undefined;

    const lines = this.findSupportAndResistance(oldData);

    if (!this.entryPoint?.c) {
      this.entryPoint = this.findEntryPoint(oldData, lines);
    }

    this.paperTrade(message);

    this.chart?.data?.datasets?.push({
      label: 'XBT/USD',
      data: oldData!.slice(-this.barCount),
    });

    !this.takeProfitOrder &&
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

    !this.takeProfitOrder &&
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

    // Draw entry point
    if (this.entryPoint) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Entry point`,
        backgroundColor: 'rgba(0, 255, 0, 0.3)',
        borderColor: 'rgba(0, 255, 0, 0.8)',
        pointBackgroundColor: 'rgba(0, 255, 0, 0.8)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(0, 255, 0, 0.8)',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPoint.x,
            y: this.entryPoint.l,
          },
          {
            x: Date.now(),
            y: this.entryPoint.l,
          },
        ],
      });
    }

    // Draw take profit order
    if (this.takeProfitOrder && this.entryPoint) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Take profit order`,
        borderColor: 'lightgreen',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPoint.x,
            y: this.takeProfitOrder,
          },
          {
            x: Date.now(),
            y: this.takeProfitOrder,
          },
        ],
      });
    }

    // Draw stop loss order
    if (this.stopLossOrder && this.entryPoint) {
      this.chart?.data?.datasets?.push({
        type: 'line',
        label: `Stop Loss order`,
        borderColor: 'purple',
        borderWidth: 4,
        fill: false,
        data: [
          {
            x: this.entryPoint.x,
            y: this.stopLossOrder,
          },
          {
            x: Date.now(),
            y: this.stopLossOrder,
          },
        ],
      });
    }

    this.chart?.chart?.update();
  }

  mapStream(candle: string[]): FinancialDataPoint {
    return {
      x: parseFloat(candle[1]) * 1000,
      o: parseFloat(candle[2]),
      h: parseFloat(candle[3]),
      l: parseFloat(candle[4]),
      c: parseFloat(candle[5]),
    };
  }

  findSupportAndResistance(candles: FinancialDataPoint[]) {
    const supportLines = candles
      .filter((candlestick) => candlestick.x > 0)
      .filter((value, index, array) => {
        if (
          index > 0 &&
          index < array.length - 2 &&
          array[index - 1].l >= value.l &&
          array[index + 1].l > value.l
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => a.l - b.l);

    const resistanceLines = candles
      .filter((value, index, array) => {
        if (
          index > 0 &&
          index < array.length - 2 &&
          array[index - 1].h <= value.h &&
          array[index + 1].h < value.h
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => b.h - a.h);

    const averageBarHeight =
      candles
        .map((candlestick) => candlestick.h - candlestick.l)
        .reduce((previous, current) => previous + current) / candles.length;

    const uniqueSupportLines: FinancialDataPoint[] = [];

    supportLines.forEach((supportLine, index, array) => {
      if (index === 0) {
        uniqueSupportLines.push(supportLine);
      }

      if (index > 0) {
        const isUnique = uniqueSupportLines.every((uniqueSupportLine) => {
          return (
            Math.abs(supportLine.l - uniqueSupportLine.l) > 2 * averageBarHeight
          );
        });

        if (isUnique) {
          uniqueSupportLines.push(supportLine);
        }
      }
    });

    const uniqueResistanceLines: FinancialDataPoint[] = [];

    resistanceLines.forEach((resistanceLine, index, array) => {
      if (index === 0) {
        uniqueResistanceLines.push(resistanceLine);
      }

      if (index > 0) {
        const isUnique = uniqueResistanceLines.every((uniqueResistanceLine) => {
          return (
            Math.abs(resistanceLine.h - uniqueResistanceLine.h) >
            2 * averageBarHeight
          );
        });

        if (isUnique) {
          uniqueResistanceLines.push(resistanceLine);
        }
      }
    });

    return {
      supportLines: uniqueSupportLines,
      resistanceLines: uniqueResistanceLines,
    };
  }

  findEntryPoint(
    candles: FinancialDataPoint[],
    supportAndResistanceLines: {
      supportLines: FinancialDataPoint[];
      resistanceLines: FinancialDataPoint[];
    }
  ): FinancialDataPoint | undefined {
    // Find closest support line
    const closestSupportLine = supportAndResistanceLines.supportLines
      .sort((a, b) => b.l - a.l)
      .find((supportLine) => {
        return candles[candles.length - 1].l > supportLine.l;
      });

    return closestSupportLine;
  }

  paperTrade(lastCandle: FinancialDataPoint) {
    if (this.hasPosition && this.openOrder) {
      this.runningPnl = lastCandle.c - this.openOrder;
    }

    if (
      this.entryPoint &&
      this.openOrder &&
      !this.hasPosition &&
      lastCandle.l <= this.openOrder
    ) {
      this.hasPosition = true;
      this.takeProfitOrder = this.entryPoint.l * (1 + this.profitTarget);
      this.stopLossOrder = this.entryPoint.l * (1 - this.stopLoss);

      console.log(`Buy order filled at ${this.openOrder}`);
      console.log(`Creating take profit order at ${this.takeProfitOrder}`);
      console.log(`Creating stop loss order at ${this.stopLossOrder}`);

      return;
    }

    // Create new buy order if there isn't any
    // Update order when entry point is updated
    if (
      !this.hasPosition &&
      this.entryPoint &&
      (!this.openOrder || this.openOrder !== this.entryPoint.l)
    ) {
      console.log(`Creating buy order at ${this.entryPoint.l}`);

      this.openOrder = this.entryPoint.l;

      this.entryPoint = undefined;
    }
  }
}
