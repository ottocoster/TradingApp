import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgChartsModule } from 'ng2-charts';
import { HttpClientModule } from '@angular/common/http';
import { FinancialChartComponent } from './financial-chart/financial-chart.component';

@NgModule({
  declarations: [AppComponent, FinancialChartComponent],
  imports: [HttpClientModule, BrowserModule, NgChartsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
