import { Component, OnInit, ViewChild } from '@angular/core';
import 'chartjs-adapter-date-fns';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartType } from 'chart.js';
import { enUS } from 'date-fns/locale';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
} from 'chartjs-chart-financial';
import { QuotesService } from '../quotes.service';
import { delay } from 'rxjs';

@Component({
  selector: 'app-financial-chart',
  templateUrl: './financial-chart.component.html',
})
export class FinancialChartComponent implements OnInit {
  barCount = 60;

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

  public financialChartType: ChartType = 'candlestick';

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  constructor(private quotesService: QuotesService) {
    Chart.register(
      CandlestickController,
      OhlcController,
      CandlestickElement,
      OhlcElement
    );
  }

  ngOnInit(): void {
    this.quotesService
      .getQuotes()
      .pipe(delay(2000))
      .subscribe((r) => {
        this.chart?.data?.datasets?.push({
          label: 'Quotes3',
          data: r.slice(-this.barCount),
        });
        this.chart?.chart?.update();
      });
  }
}
