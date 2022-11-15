import { FinancialDataPoint } from 'chart.js';

export function findSupportAndResistance(candles: FinancialDataPoint[]) {
  const supportLines = candles
    .filter((candlestick) => candlestick.x > 0)
    .filter((value, index, array) => {
      if (
        index > 1 &&
        index < array.length - 3 &&
        array[index - 2].l >= value.l &&
        array[index - 1].l >= value.l &&
        array[index + 1].l > value.l &&
        array[index + 2].l > value.l
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => a.l - b.l);

  const resistanceLines = candles
    .filter((value, index, array) => {
      if (
        index > 1 &&
        index < array.length - 3 &&
        array[index - 2].h <= value.h &&
        array[index - 1].h <= value.h &&
        array[index + 1].h < value.h &&
        array[index + 2].h < value.h
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

export function findEntryPointLong(
  candle: FinancialDataPoint,
  supportAndResistanceLines: {
    supportLines: FinancialDataPoint[];
    resistanceLines: FinancialDataPoint[];
  }
): FinancialDataPoint | undefined {
  const closestSupportLine = supportAndResistanceLines.supportLines
    .sort((a, b) => b.l - a.l)
    .find((supportLine) => {
      return candle.l > supportLine.l;
    });

  return closestSupportLine;
}

export function findEntryPointShort(
  candle: FinancialDataPoint,
  supportAndResistanceLines: {
    supportLines: FinancialDataPoint[];
    resistanceLines: FinancialDataPoint[];
  }
): FinancialDataPoint | undefined {
  const closestResistanceLine = supportAndResistanceLines.resistanceLines
    .sort((a, b) => a.h - b.h)
    .find((resistanceLine) => {
      return candle.h < resistanceLine.h;
    });

  return closestResistanceLine;
}
