import {Options} from '../misc/Options';
import {Utils} from './Utils';
import {l} from '../strings/Strings';
import {TimeSpan} from './TimeSpanUtils';

declare var Globalize;

export interface DateToStringOptions {
  now?: Date;
  useTodayYesterdayAndTomorrow?: boolean;
  useWeekdayIfThisWeek?: boolean;
  omitYearIfCurrentOne?: boolean;
  useLongDateFormat?: boolean;
  includeTimeIfToday?: boolean;
  includeTimeIfThisWeek?: boolean;
  alwaysIncludeTime?: boolean;
  predefinedFormat?: string;
}

class DefaultDateToStringOptions extends Options implements DateToStringOptions {
  now: Date = new Date();
  useTodayYesterdayAndTomorrow = true;
  useWeekdayIfThisWeek = true;
  omitYearIfCurrentOne = true;
  useLongDateFormat = false;
  includeTimeIfToday = true;
  includeTimeIfThisWeek = true;
  alwaysIncludeTime = false;
  predefinedFormat: string = undefined;
}

export class DateUtils {
  static convertFromJsonDateIfNeeded(date: string): Date;
  static convertFromJsonDateIfNeeded(date: number): Date;
  static convertFromJsonDateIfNeeded(date: Date): Date;
  static convertFromJsonDateIfNeeded(date: any): Date {
    if (_.isDate(date)) {
      return date;
    } else if (date !== null && !isNaN(Number(date))) {
      return new Date(Number(date));
    } else if (_.isString(date)) {
      return new Date(<string>date.replace('@', ' '));
    } else {
      return undefined;
    }
  }

  static keepOnlyDatePart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  static offsetDateByDays(date: Date, offset: number): Date {
    var newDate = new Date(date.valueOf());
    newDate.setDate(newDate.getDate() + offset);

    return newDate;
  }

  static dateToString(date: Date, options?: DateToStringOptions): string {
    if (Utils.isNullOrUndefined(date)) {
      return '';
    }

    options = new DefaultDateToStringOptions().merge(options);

    if (Utils.isNullOrUndefined(date)) {
      return '';
    }

    var date = DateUtils.keepOnlyDatePart(date);

    if (options.predefinedFormat) {
      return Globalize.format(date, options.predefinedFormat);
    }

    var today = DateUtils.keepOnlyDatePart(options.now);
    if (options.useTodayYesterdayAndTomorrow) {
      if (date.valueOf() == today.valueOf()) {
        return l('Today');
      }
      var tomorrow = DateUtils.offsetDateByDays(today, 1);
      if (date.valueOf() == tomorrow.valueOf()) {
        return l('Tomorrow');
      }
      var yesterday = DateUtils.offsetDateByDays(today, -1);
      if (date.valueOf() == yesterday.valueOf()) {
        return l('Yesterday');
      }
    }

    var isThisWeek = Math.abs(TimeSpan.fromDates(date, today).getDays()) < 7;
    if (options.useWeekdayIfThisWeek && isThisWeek) {
      if (date.valueOf() > today.valueOf()) {
        return l('Next') + ' ' + Globalize.format(date, 'dddd');
      } else {
        return l('Last') + ' ' + Globalize.format(date, 'dddd');
      }
    }

    if (options.omitYearIfCurrentOne && date.getFullYear() === today.getFullYear()) {
      return Globalize.format(date, 'M');
    }

    if (options.useLongDateFormat) {
      return Globalize.format(date, 'D');
    }

    return Globalize.format(date, 'd');
  }

  static timeToString(date: Date, options?: DateToStringOptions): string {
    if (Utils.isNullOrUndefined(date)) {
      return '';
    }

    return Globalize.format(date, 't');
  }

  static dateTimeToString(date: Date, options?: DateToStringOptions): string {
    if (Utils.isNullOrUndefined(date)) {
      return '';
    }

    options = new DefaultDateToStringOptions().merge(options);

    var today = DateUtils.keepOnlyDatePart(options.now);
    var isThisWeek = Math.abs(TimeSpan.fromDates(date, today).getDays()) < 7;
    var datePart = DateUtils.dateToString(date, options);
    var dateWithoutTime = DateUtils.keepOnlyDatePart(date);

    if (options.alwaysIncludeTime || (options.includeTimeIfThisWeek && isThisWeek) || (options.includeTimeIfToday && dateWithoutTime.valueOf() == today.valueOf())) {
      return datePart + ', ' + DateUtils.timeToString(date);
    } else {
      return datePart;
    }
  }

  static monthToString(month: number): string {
    var date = new Date(1980, month);
    return Globalize.format(date, 'MMMM');
  }

  static isValid(date: any) {
    if (date instanceof Date) {
      return !isNaN(date.getTime())
    }
    return false;
  }

  static timeBetween(from: Date, to: Date) {
    if (Utils.isNullOrUndefined(from) || Utils.isNullOrUndefined(to)) {
      return '';
    }

    return ('0' + ((to.getTime() - from.getTime()) / (1000 * 60 * 60)).toFixed()).slice(-2) +
      ':' + ('0' + ((to.getTime() - from.getTime()) % (1000 * 60 * 60) / (1000 * 60)).toFixed()).slice(-2) +
      ':' + ('0' + ((to.getTime() - from.getTime()) % (1000 * 60) / (1000)).toFixed()).slice(-2);
  }
}

//Shim for IE8 Date.toISOString
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
if (!Date.prototype.toISOString) {
  (function() {
    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOString = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
        'Z';
    };
  } ());
}
